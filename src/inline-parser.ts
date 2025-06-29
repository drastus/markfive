import type BlockNode from './block-node';
import {attributesRegexString, findIndexInRange, parseAttributes} from './helpers';
import InlineNode from './inline-node';
import {markfiveMathToMathML} from './math-parser';
import type {
	BlockNodeType, InlineNodeType, InlineToken, InlineTokenType, Node, Options,
} from './types';

const specialChars = /[#*[\]{}"'`:~^!|/_=$<>-]/;

const commonTokens: Array<{chars: string, type: InlineTokenType}> = [
	{chars: '\'\'', type: 'CITE'},
	{chars: '__', type: 'U'},
	{chars: '--', type: 'S'},
	{chars: '#', type: 'B'},
	{chars: '/', type: 'I'},
	{chars: '~', type: 'EM'},
	{chars: '*', type: 'STRONG'},
	{chars: '=', type: 'MARK'},
	{chars: ':', type: 'DFN'},
	{chars: '^', type: 'SUP'},
	{chars: '_', type: 'SUB'},
	{chars: '$', type: 'VAR'},
	{chars: '`', type: 'CODE'},
	{chars: '>', type: 'KBD'},
	{chars: '<', type: 'SAMP'},
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
					if (
						(prevIsAlphanumeric && nextIsAlphanumeric && !['SUP', 'SUB'].includes(type))
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
						if (['SUB', 'SUP'].includes(type)) {
							if (!prevIsWhitespace) {
								position.push('start');
							}
							if (!nextIsWhitespace) {
								position.push('end');
							}
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
					match = contentRest.match(`^(\\(([^()]*(\\([^()]+\\))?[^()]*)\\))?(${attributesRegexString})?`);
					if (match?.[2] || match?.[4]) {
						newToken.defaultAttribute = match[2];
						newToken.attributes = match[4];
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
		let expectedNoteSubtype: string | undefined;

		if (node.type !== 'INLINE_MATH') {
			while (index < tokens.length) {
				const token = tokens[index]!;
				let attributes: Record<string, string | string[]> | undefined;

				if (token.type === 'MATH') {
					index++;
					continue;
				}
				if (token.type === 'BRACKET_OPEN') {
					const closeTokenIndex = findIndexInRange<InlineToken>(
						tokens, (t) => t.type === 'BRACKET_CLOSE', index + 1,
					);
					if (closeTokenIndex !== undefined
						&& tokens.slice(index + 1, closeTokenIndex).every((t) => t.text === '*')
						&& !expectedNoteSubtype
						&& !tokens[closeTokenIndex]!.defaultAttribute
					) {
						expectedNoteSubtype = '*'.repeat(tokens.slice(index + 1, closeTokenIndex).length);
						index = closeTokenIndex + 1;
					} else if (closeTokenIndex !== undefined
						&& (expectedNoteSubtype
							|| (tokens.slice(index + 1, closeTokenIndex).every((t) => t.text === '*')
								&& tokens[closeTokenIndex]!.defaultAttribute
							)
						)
					) {
						const newNode = new InlineNode('NOTE', {
							subtype: expectedNoteSubtype ?? tokens.slice(index + 1, closeTokenIndex).map((t) => t.text).join(''),
							id: parseAttributes(tokens[closeTokenIndex]!.defaultAttribute)?.id as string | undefined,
							tokens: tokens.slice(index + 1, closeTokenIndex),
							attributes: parseAttributes(tokens[closeTokenIndex]!.attributes),
						});
						node.children.push(newNode);
						expectedNoteSubtype = undefined;
						index = closeTokenIndex + 1;
					} else if (closeTokenIndex !== undefined && tokens[closeTokenIndex]!.defaultAttribute) {
						const newNode = new InlineNode('A', {
							tokens: tokens.slice(index + 1, closeTokenIndex),
							attributes: {href: tokens[closeTokenIndex]!.defaultAttribute!}, // add other link attributes
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
						let newNode = new InlineNode(
							token.type as InlineNodeType,
							{tokens: tokens.slice(index + 1, closeTokenIndex), attributes},
						);
						const contentText = tokens.slice(index + 1, closeTokenIndex).map((t) => t.text).join('');
						if (token.type === 'VAR') {
							if (!this.canBeVar(contentText)) {
								newNode = new InlineNode(
									'INLINE_MATH',
									{
										content: markfiveMathToMathML(contentText, false, this.options.debug),
										attributes,
									},
								);
							}
						}
						if (['SUP', 'SUB'].includes(token.type)
							&& (((tokens[index - 1]?.type !== 'TEXT' || tokens[index - 1]?.text!.endsWith(' '))
								&& (tokens[closeTokenIndex + 1]?.type !== 'TEXT' || tokens[closeTokenIndex + 1]?.text!.startsWith(' ')))
								|| contentText.includes(' '))
						) {
							if (tokens[index + 1]!.type === 'BRACKET_OPEN' && tokens[closeTokenIndex - 1]!.type === 'BRACKET_CLOSE') {
								newNode = new InlineNode(token.type as InlineNodeType, {
									tokens: tokens.slice(index + 2, closeTokenIndex - 1),
									attributes,
								});
								node.children.push(newNode);
							} else {
								this.addTextNode(node.children, token.text + contentText + tokens[closeTokenIndex]!.text);
							}
						} else {
							node.children.push(newNode);
						}
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
		}
		if (node.type === 'TEXT' && node.children.length === 1 && node.children[0]!.type === 'TEXT') {
			node.children = [];
		}
		if (!this.options['debug-tokens']) {
			node.tokens = undefined;
			if (node.children.length > 0) node.content = undefined;
		}
	};

	canBeVar = (text: string) => (
		text.match(/^\p{L}+$/u)
	);
}

export default InlineParser;
