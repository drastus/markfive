import type BlockNode from './block-node';
import {attributesRegexString, findIndexInRange, parseAttributes} from './helpers';
import InlineNode from './inline-node';
import type {
	BlockNodeType,
	InlineNodeType, InlineToken, InlineTokenType, Node, Options,
} from './types';

const specialChars = /[#*[\]{}"'`:~^!|/_=-]/;

const commonTokens: Array<{chars: string, type: InlineTokenType}> = [
	{chars: '#', type: 'B'},
	{chars: '/', type: 'I'},
	{chars: '__', type: 'U'},
	{chars: '--', type: 'S'},
	{chars: '\'\'', type: 'CITE'},
	{chars: '~', type: 'EM'},
	{chars: '*', type: 'STRONG'},
	{chars: '=', type: 'MARK'},
	{chars: ':', type: 'DFN'},
	{chars: '$', type: 'VAR'},
	{chars: '`', type: 'CODE'},
];
const tableRowTokens: Array<{chars: string, type: InlineTokenType}> = [
	{chars: '|', type: 'TD'},
	{chars: '!', type: 'TH'},
];

const selfNestableTokenTypes = ['B', 'I', 'EM', 'STRONG', 'MARK'];

class InlineParser {
	ast: Node;
	current: number;
	options: Options;

	constructor(source: Node, options: Options) {
		this.ast = source;
		this.current = 0;
		this.options = options;
	}

	parse = () => {
		if (this.options.debug) console.log('InlineParser tokenize & parse\n');

		this.parseNode(this.ast as BlockNode);

		if (this.options.ast || this.options.debug) console.log(`${JSON.stringify(this.ast, null, 4)}\n`);
		return this.ast;
	};

	parseNode = (node: BlockNode) => {
		if (node.content ?? node.tokens) {
			node.tokens ||= this.getNodeTokens(node.content!, node.type);
			this.parseTokenizedNode(node);
		}
		if (node.children) {
			node.children.forEach((child) => {
				this.parseNode(child as BlockNode);
			});
		}
	};

	addTextToken = (tokens: InlineToken[], text: string) => {
		const lastToken = tokens[tokens.length - 1];
		if (lastToken?.type === 'TEXT') {
			lastToken.text += text;
		} else {
			tokens.push({type: 'TEXT', text});
		}
	};

	getNodeTokens = (content: string, type: BlockNodeType) => {
		const tokens: InlineToken[] = [];
		let index = 0;

		if (type === 'BLOCK_MATH') {
			tokens.push({type: 'MATH', text: content});
			return tokens;
		}

		const availableTokens = type === 'TABLE_ROW'
			? commonTokens.concat(tableRowTokens)
			: commonTokens;

		while (index < content.length) {
			const nextSpecialCharIndex = content.slice(index).search(specialChars);
			let consumedChars = 0;
			let match: RegExpMatchArray | null = null;

			if (nextSpecialCharIndex < 0) {
				this.addTextToken(tokens, content.slice(index));
				index = content.length;
				break;
			}

			for (const {chars, type} of availableTokens) {
				if (content[index + nextSpecialCharIndex] === chars[0]) {
					if (chars.length === 2 && content[index + nextSpecialCharIndex + 1] !== chars[1]) {
						continue; // optimize
					}
					if (nextSpecialCharIndex > 0) {
						this.addTextToken(tokens, content.slice(index, index + nextSpecialCharIndex));
					}

					consumedChars = chars.length;
					const prevIsAlphanumeric = /^(\p{L}|\p{M}|\p{N})/u.test(content[index + nextSpecialCharIndex - 1] ?? '');
					const nextIsAlphanumeric = /^(\p{L}|\p{M}|\p{N})/u.test(content[index + nextSpecialCharIndex + consumedChars] ?? '');
					const prevIsWhitespace = /^(\p{Z})/u.test(content[index + nextSpecialCharIndex - 1] ?? '');
					const nextIsWhitespace = /^(\p{Z})/u.test(content[index + nextSpecialCharIndex + consumedChars] ?? '');
					if ((prevIsAlphanumeric && nextIsAlphanumeric)
						|| ((prevIsWhitespace && nextIsWhitespace) && !['TD', 'TH'].includes(type))
						|| ((prevIsAlphanumeric || nextIsAlphanumeric) && ['TD', 'TH'].includes(type))
					) {
						this.addTextToken(tokens, content.slice(
							index + nextSpecialCharIndex,
							index + nextSpecialCharIndex + consumedChars,
						));
					} else {
						const position: Array<'start' | 'end'> = [];
						if (!prevIsAlphanumeric && !nextIsWhitespace) {
							position.push('start');
						}
						if (!nextIsAlphanumeric && !prevIsWhitespace) {
							position.push('end');
						}
						const newToken: InlineToken = {
							type,
							position,
							text: content.slice(index + nextSpecialCharIndex, index + nextSpecialCharIndex + consumedChars),
						};
						const contentRest = content.slice(index + nextSpecialCharIndex + consumedChars);
						if (!position.includes('start')) {
							match = contentRest.match(`^${attributesRegexString}`);
							if (match?.[1]) {
								newToken.attributes = match[1];
								consumedChars += match[0].length;
							}
						}
						tokens.push(newToken);
					}
					break;
				}
			}
			if (consumedChars === 0) {
				if (content[index + nextSpecialCharIndex] === '[') {
					if (nextSpecialCharIndex > 0) {
						this.addTextToken(tokens, content.slice(index, index + nextSpecialCharIndex));
					}
					tokens.push({type: 'BRACKET_OPEN', text: '['});
					consumedChars = 1;
				} else if (content[index + nextSpecialCharIndex] === ']') {
					if (nextSpecialCharIndex > 0) {
						this.addTextToken(tokens, content.slice(index, index + nextSpecialCharIndex));
					}
					const newToken: InlineToken = {type: 'BRACKET_CLOSE'};
					const contentRest = content.slice(index + nextSpecialCharIndex + 1);
					match = contentRest.match(/^\(([^()]*(\([^()]+\))?[^()]*)\)/);
					if (match?.[1]) {
						newToken.defaultAttribute = match[1];
						newToken.text = ']' + match[0];
						consumedChars = 1 + match[0].length;
					} else {
						newToken.text = ']';
						consumedChars = 1;
					}
					tokens.push(newToken);
				}
			}
			if (consumedChars === 0) {
				this.addTextToken(tokens, content.slice(index, index + nextSpecialCharIndex + 1));
				consumedChars = 1;
			}

			index = index + nextSpecialCharIndex + consumedChars;
		}

		return tokens;
	};

	addTextNode = (nodes: Node[], text: string) => {
		const lastNode = nodes[nodes.length - 1];
		if (lastNode?.type === 'TEXT') {
			lastNode.content += text;
		} else {
			nodes.push(new InlineNode('TEXT', {content: text}));
		}
	};

	parseTokenizedNode = (node: Node) => {
		const tokens = node.tokens!;
		let index = 0;

		while (index < tokens.length) {
			const token = tokens[index]!;
			let attributes: Record<string, string | string[]> | undefined;

			if (token.type === 'MATH') {
				index++;
				continue;
			}
			if (token.type === 'BRACKET_OPEN') {
				const closeTokenIndex = findIndexInRange<InlineToken>(
					tokens, (t) => t.type === 'BRACKET_CLOSE' && t.defaultAttribute, index + 1,
				);
				if (closeTokenIndex !== undefined) {
					const newNode = new InlineNode('A', {
						tokens: tokens.slice(index + 1, closeTokenIndex),
						attributes: {href: tokens[closeTokenIndex]!.defaultAttribute!},
					});
					node.children.push(newNode);
					index = closeTokenIndex + 1;
				} else {
					this.addTextNode(node.children, token.text!);
					index++;
				}
			} else if (['TD', 'TH'].includes(token.type)) {
				const nextCellTokenIndex = findIndexInRange<InlineToken>(
					tokens, (t) => ['TD', 'TH'].includes(t.type), index + 1,
				) ?? tokens.length;
				const newNode = new InlineNode(token.type as InlineNodeType, {
					tokens: tokens.slice(index + 1, nextCellTokenIndex),
				});
				node.children.push(newNode);
				index = nextCellTokenIndex;
			} else if (token.position?.includes('start')) {
				let closeTokenIndex: number | undefined;
				if (selfNestableTokenTypes.includes(token.type)) {
					let startIndex = index + 1;
					let newTokenIndex: number | undefined;
					let depth = 1;
					do {
						newTokenIndex = findIndexInRange<InlineToken>(
							tokens, (t) => t.type === token.type, startIndex,
						);
						if (newTokenIndex !== undefined) {
							if (tokens[newTokenIndex]!.position?.includes('end') && newTokenIndex > startIndex) {
								closeTokenIndex = newTokenIndex;
								if (tokens[newTokenIndex]!.attributes) {
									attributes = parseAttributes(tokens[newTokenIndex]!.attributes);
								}
								depth -= 1;
							} else {
								depth += 1;
							}
							startIndex = newTokenIndex + 1;
						}
					} while (depth > 0 && newTokenIndex !== undefined);
				} else {
					closeTokenIndex = findIndexInRange<InlineToken>(
						tokens, (t) => t.type === token.type && t.position?.includes('end'), index + 1,
					);
				}
				if (closeTokenIndex !== undefined) {
					const newNode = new InlineNode(
						token.type as InlineNodeType,
						{tokens: tokens.slice(index + 1, closeTokenIndex), attributes},
					);
					node.children.push(newNode);
					index = closeTokenIndex + 1;
				} else {
					this.addTextNode(node.children, token.text!);
					index++;
				}
			} else {
				this.addTextNode(node.children, token.text!);
				index++;
			}
		}
		if (node.type === 'TEXT' && node.children.length === 1 && node.children[0]!.type === 'TEXT') {
			node.children = [];
		}
		if (!this.options.debug) {
			node.tokens = undefined;
			if (node.children.length > 0) node.content = undefined;
		}
	};
}

export default InlineParser;
