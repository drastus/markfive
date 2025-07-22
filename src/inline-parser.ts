import type BlockNode from './block-node';
import {attributesRegexString, findIndexInRange, findIndicesInRange, parseAttributes} from './helpers';
import InlineNode from './inline-node';
import {markfiveMathToMathML} from './math-parser';
import type {
	BlockNodeType, InlineNodeType, InlineToken, InlineTokenType, Node, Options,
} from './types';

const specialChars = /[#*[\]{}"'`:~^!|/_=$<>&?-]/;

const commonTokens: Array<{chars: string, type: InlineTokenType, position?: 'start' | 'end'}> = [
	// 4 chars
	{chars: '{/?}', type: 'WBR'},
	// 3 chars
	{chars: '{/}', type: 'BR'},
	{chars: ']+[', type: 'KEY_JOINER'},
	// 2 chars
	{chars: '\'\'', type: 'CITE'},
	{chars: '__', type: 'U'},
	{chars: '--', type: 'S'},
	{chars: '[[', type: 'KEY', position: 'start'},
	{chars: ']]', type: 'KEY', position: 'end'},
	{chars: '[|', type: 'BUTTON', position: 'start'},
	{chars: '|]', type: 'BUTTON', position: 'end'},
	{chars: '?[', type: 'SPAN', position: 'start'},
	{chars: ']?', type: 'SPAN', position: 'end'},
	// 1 char
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
	{chars: '&', type: 'IMAGE'},
	{chars: '|', type: 'BUTTON_SEPARATOR'}, // should be last
];
const tableRowTokens: Array<{chars: string, type: InlineTokenType}> = [
	{chars: '|', type: 'TD'},
	{chars: '!', type: 'TH'},
];

const selfNestableTokenTypes = ['B', 'I', 'EM', 'STRONG', 'MARK', 'SPAN'];

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
			? commonTokens.slice(0, -1).concat(tableRowTokens)
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

			for (let {chars, type, position} of availableTokens) {
				if (content.slice(index + nextSpecialCharIndex, index + nextSpecialCharIndex + chars.length) === chars) {
					if (type === 'IMAGE' && content[index + nextSpecialCharIndex + 1] !== '[') {
						continue;
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
						(prevIsAlphanumeric && nextIsAlphanumeric && !['SUP', 'SUB', 'KEY_JOINER', 'BUTTON_SEPARATOR', 'BR', 'WBR'].includes(type))
						|| (prevIsWhitespace && nextIsWhitespace && !['TD', 'TH'].includes(type))
						|| ((prevIsAlphanumeric || nextIsAlphanumeric) && type === 'TH')
					) {
						this.addTextToken(tokens, content.slice(
							index + nextSpecialCharIndex,
							index + nextSpecialCharIndex + consumedChars,
						));
					} else {
						if (type === 'TD' && (prevIsAlphanumeric || nextIsAlphanumeric)) {
							type = 'BUTTON_SEPARATOR';
						}

						const positions: Array<'start' | 'end'> = [];
						if (!prevIsAlphanumeric && !nextIsWhitespace && position !== 'end') {
							positions.push('start');
						}
						if (!nextIsAlphanumeric && !prevIsWhitespace && position !== 'start') {
							positions.push('end');
						}
						if (['SUB', 'SUP'].includes(type)) {
							if (!prevIsWhitespace) {
								positions.push('start');
							}
							if (!nextIsWhitespace) {
								positions.push('end');
							}
						}
						const newToken: InlineToken = {
							type,
							positions,
							text: content.slice(index + nextSpecialCharIndex, index + nextSpecialCharIndex + consumedChars),
						};
						const contentRest = content.slice(index + nextSpecialCharIndex + consumedChars);
						if (!positions.includes('start')) {
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

		if (node.type === 'INLINE_MATH') index = tokens.length; // don't parse inline math

		while (index < tokens.length) {
			const token = tokens[index]!;
			let attributes: Record<string, string | string[]> | undefined;

			if (token.type === 'MATH') {
				index++;
				continue;
			}
			if (['BR', 'WBR'].includes(token.type)) {
				node.children.push(new InlineNode(token.type as 'BR' | 'WBR'));
				index++;
			} else if (token.type === 'BRACKET_OPEN') {
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
					if (tokens[index - 1]?.type === 'IMAGE') {
						const innerTokens = tokens.slice(index + 1, closeTokenIndex);
						if (innerTokens.length > 1) {
							const newNode = new InlineNode('OBJECT', {
								tokens: innerTokens,
								attributes: {
									data: tokens[closeTokenIndex]!.defaultAttribute,
									role: 'img',
									...parseAttributes(tokens[closeTokenIndex]!.attributes),
								},
							});
							node.children.push(newNode);
						} else {
							const newNode = new InlineNode('IMG', {
								attributes: {
									src: tokens[closeTokenIndex]!.defaultAttribute,
									alt: innerTokens[0]!.text ?? '',
									...parseAttributes(tokens[closeTokenIndex]!.attributes),
								},
							});
							node.children.push(newNode);
						}
					} else {
						const newNode = new InlineNode('A', {
							tokens: tokens.slice(index + 1, closeTokenIndex),
							attributes: {href: tokens[closeTokenIndex]!.defaultAttribute, ...parseAttributes(tokens[closeTokenIndex]!.attributes)},
						});
						node.children.push(newNode);
					}
					index = closeTokenIndex + 1;
				} else {
					if (tokens[index - 1]?.type === 'IMAGE') {
						this.addTextNode(node.children, tokens[index - 1]!.text!);
					}
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
			} else if (token.type === 'IMAGE') {
				index++;
			} else if (token.positions?.includes('start')) {
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
							if (tokens[newTokenIndex]!.positions?.includes('end') && newTokenIndex >= startIndex) {
								closeTokenIndex = newTokenIndex;
								depth -= 1;
							} else {
								depth += 1;
							}
							startIndex = newTokenIndex + 1;
						}
					} while (depth > 0 && newTokenIndex !== undefined);
				} else { // non-self-nestable
					closeTokenIndex = findIndexInRange<InlineToken>(
						tokens, (t) => t.type === token.type && t.positions?.includes('end'), index + 1,
					);
				}
				if (closeTokenIndex !== undefined) { // close token found
					if (tokens[closeTokenIndex]!.attributes) {
						attributes = parseAttributes(tokens[closeTokenIndex]!.attributes);
					}
					let newNode = new InlineNode(
						token.type as InlineNodeType,
						{tokens: tokens.slice(index + 1, closeTokenIndex), attributes},
					);
					if (token.type === 'KEY') {
						const joinerIndices = findIndicesInRange<InlineToken>(
							tokens, (t) => t.type === 'KEY_JOINER', index + 1, closeTokenIndex,
						);
						if (joinerIndices.length > 0) {
							newNode = new InlineNode(
								'KBD',
								{children: [], attributes},
							);
							let subindex = index + 1;
							for (const joinerIndex of joinerIndices) {
								newNode.children.push(new InlineNode(
									'KEY',
									{
										tokens: tokens.slice(subindex, joinerIndex),
										attributes,
									},
								));
								newNode.children.push(new InlineNode('KEY_JOINER'));
								subindex = joinerIndex + 1;
							}
							newNode.children.push(new InlineNode(
								'KEY',
								{
									tokens: tokens.slice(subindex, closeTokenIndex),
									attributes,
								},
							));
						}
						node.children.push(newNode);
						index = closeTokenIndex + 1;
						continue;
					}
					if (token.type === 'BUTTON') {
						const separatorIndices = findIndicesInRange<InlineToken>(
							tokens, (t) => t.type === 'BUTTON_SEPARATOR', index + 1, closeTokenIndex,
						);
						if (separatorIndices.length > 0) {
							newNode = new InlineNode(
								'KBD',
								{children: [], attributes},
							);
							let subindex = index + 1;
							for (const separatorIndex of separatorIndices) {
								newNode.children.push(new InlineNode(
									'BUTTON',
									{
										tokens: tokens.slice(subindex, separatorIndex),
										attributes,
									},
								));
								newNode.children.push(new InlineNode('BUTTON_SEPARATOR'));
								subindex = separatorIndex + 1;
							}
							newNode.children.push(new InlineNode(
								'BUTTON',
								{
									tokens: tokens.slice(subindex, closeTokenIndex),
									attributes,
								},
							));
						}
						node.children.push(newNode);
						index = closeTokenIndex + 1;
						continue;
					}
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
