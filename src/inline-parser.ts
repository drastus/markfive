import type BlockNode from './block-node';
import {attributesRegexString, defaultAttributeRegexString, findCloseBracketIndexInRange, findIndexInRange, findIndicesInRange, parseAttributes} from './helpers';
import InlineNode from './inline-node';
import {markfiveMathToMathML} from './math-parser';
import type {
	BlockNodeType, InlineNodeType, InlineToken, InlineTokenType, Node, Options,
} from './types';

const specialChars = /[#*[\]{}"'`:~^!|/_=$<>&?@-]/;

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
	{chars: '[|', type: 'BUTTON', position: 'start'},
	{chars: '|]', type: 'BUTTON', position: 'end'},
	{chars: '?[', type: 'SPAN', position: 'start'},
	{chars: ']?', type: 'SPAN', position: 'end'},
	{chars: '{{', type: 'VARIABLE', position: 'start'},
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
	{chars: '@', type: 'INLINE_OTHER'},
	{chars: '[', type: 'BRACKET', position: 'start'},
	{chars: ']', type: 'BRACKET', position: 'end'},
	{chars: '|', type: 'BUTTON_SEPARATOR'}, // should be last
];
const tableRowTokens: Array<{chars: string, type: InlineTokenType}> = [
	{chars: '|', type: 'TD'},
	{chars: '!', type: 'TH'},
];

const selfNestableTokenTypes = ['EM', 'STRONG', 'MARK', 'SPAN'];
const inlineOtherElements = ['abbr', 'bdi', 'data', 'del', 'ins', 'rt', 'ruby', 'small', 'time'];

class InlineParser {
	ast: Node;
	current = 0;
	currentTable: Node | null = null;
	currentTableRows: Array<Array<Node | null>> = [];
	options: Options;
	data: Record<string, string>;

	constructor(source: Node, options: Options, data: Record<string, string>) {
		this.ast = source;
		this.options = options;
		this.data = data;
	}

	parse = () => {
		if (this.options.debug) console.log('InlineParser tokenize & parse\n');

		this.parseNode(this.ast as BlockNode);

		if (this.options.ast || this.options.debug) console.log(`${JSON.stringify(this.ast, null, 4)}\n`);
		return this.ast;
	};

	parseNode = (node: Node) => {
		if (node.type === 'TABLE') {
			this.currentTable = node;
		}
		if (node.content) {
			node.tokens ||= this.getNodeTokens(node.content!, node.type as BlockNodeType);
		}
		if (node.tokens) {
			this.parseTokenizedNode(node);
		}
		if (node.children) {
			node.children.forEach((child) => {
				if (child.type !== 'TEXT') this.parseNode(child);
			});
		}
		if (node.type === 'TABLE') {
			this.reparseCurrentTable();
		}
	};

	reparseCurrentTable = () => {
		const rowspanNodes: Node[] = [];
		this.currentTableRows.forEach((row) => {
			row.forEach((cell, i) => {
				if (cell && (cell.attributes?.rowspan ?? 1) as number > 1) {
					rowspanNodes[i] = cell;
				} else if (cell?.attributes?.['data-in-rowspan'] && rowspanNodes[i]) {
					rowspanNodes[i].children = [
						...(rowspanNodes[i].children ?? []),
						new InlineNode('TEXT', {content: '\n'}),
						...(cell.children ?? []),
					];
				}
			});
		});
		this.currentTable = null;
		this.currentTableRows = [];
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

		if (['BLOCK_MATH', 'INLINE_MATH'].includes(type)) {
			tokens.push({type: 'MATH', text: content});
			return tokens;
		}

		const availableTokens = type === 'TABLE_CELLS'
			? commonTokens.slice(0, -1).concat(tableRowTokens)
			: commonTokens;

		while (index < content.length) {
			const nextSpecialCharIndex = content.slice(index).search(specialChars);
			if (nextSpecialCharIndex < 0) {
				this.addTextToken(tokens, content.slice(index));
				index = content.length;
				break;
			}
			const startIndex = index + nextSpecialCharIndex;
			let consumedChars = 0;
			let match: RegExpMatchArray | null = null;

			for (let {chars, type, position} of availableTokens) {
				if (content.slice(startIndex, startIndex + chars.length) === chars) {
					if (type === 'IMAGE' && content[startIndex + 1] !== '[') {
						continue;
					}
					if (type === 'INLINE_OTHER' && !inlineOtherElements.some((e) => `${e}[` === content.slice(startIndex + 1, startIndex + e.length + 2))) {
						continue;
					}

					consumedChars = chars.length;

					let backslashesSequenceLength = 0;
					while (content[startIndex - 1 - backslashesSequenceLength] === '\\') {
						backslashesSequenceLength++;
					}
					if (backslashesSequenceLength % 2 === 1) {
						this.addTextToken(
							tokens,
							content.slice(index, startIndex - 1 - Math.floor(backslashesSequenceLength / 2))
								+ content.slice(startIndex, startIndex + chars.length),
						);
						break;
					} else if (backslashesSequenceLength > 0) {
						this.addTextToken(tokens, content.slice(index, startIndex - Math.floor(backslashesSequenceLength / 2)));
					} else if (nextSpecialCharIndex > 0) {
						this.addTextToken(tokens, content.slice(index, startIndex));
					}

					const prevIsAlphanumeric = /^(\p{L}|\p{M}|\p{N})/u.test(content[startIndex - 1] ?? '');
					const nextIsAlphanumeric = /^(\p{L}|\p{M}|\p{N})/u.test(content[startIndex + consumedChars] ?? '');
					const prevIsWhitespace = /^(\p{Z})/u.test(content[startIndex - 1] ?? '');
					const nextIsWhitespace = /^(\p{Z})/u.test(content[startIndex + consumedChars] ?? '');
					if (
						(prevIsAlphanumeric && nextIsAlphanumeric && !['SUP', 'SUB', 'KEY_JOINER', 'BUTTON_SEPARATOR', 'BR', 'WBR', 'BRACKET', 'VARIABLE'].includes(type))
						|| (prevIsWhitespace && nextIsWhitespace && !['TD', 'TH'].includes(type))
						|| ((prevIsAlphanumeric || nextIsAlphanumeric) && type === 'TH')
					) {
						this.addTextToken(tokens, content.slice(startIndex, startIndex + consumedChars));
					} else {
						if (type === 'TD' && (prevIsAlphanumeric || nextIsAlphanumeric)) {
							type = 'BUTTON_SEPARATOR';
						}

						const positions = new Set<'start' | 'end'>();
						if (!prevIsAlphanumeric && !nextIsWhitespace && position !== 'end') {
							positions.add('start');
						}
						if (!nextIsAlphanumeric && !prevIsWhitespace && position !== 'start') {
							positions.add('end');
						}
						if (content[startIndex + consumedChars] === '[') {
							positions.add('start');
						}
						if (content[startIndex - 1] === ']') {
							positions.add('end');
						}
						if (['SUB', 'SUP'].includes(type)) {
							if (!prevIsWhitespace) {
								positions.add('start');
							}
							if (!nextIsWhitespace) {
								positions.add('end');
							}
						}
						if (type === 'BRACKET') {
							positions.add(position!);
						}
						const newToken: InlineToken = {
							type,
							positions,
							text: content.slice(startIndex, startIndex + consumedChars),
						};
						const contentRest = content.slice(startIndex + consumedChars);
						if (!positions.has('start') || ['TD', 'TH'].includes(type)) {
							match = contentRest.match(`^${attributesRegexString}`);
							if (match?.[1]) {
								newToken.attributes = match[1];
								consumedChars += match[0].length;
							}
						}
						if (['BRACKET', 'DFN'].includes(type) && positions.has('end')) {
							match = contentRest.match(`^(${defaultAttributeRegexString})?(${attributesRegexString})?`);
							if (match?.[2] || match?.[4]) {
								newToken.defaultAttribute = match[2];
								newToken.attributes = match[4];
								newToken.text += match[0];
								consumedChars = 1 + match[0].length;
							}
						}
						if (type === 'VARIABLE') {
							match = contentRest.match(/^([A-Za-z][A-Za-z0-9_]+)}}/);
							newToken.type = 'TEXT';
							if (match?.[1]) {
								newToken.text = this.data[match[1]] ?? '';
								consumedChars += match[0].length;
							} else {
								newToken.text = chars;
							}
						}

						tokens.push(newToken);
					}
					break;
				}
			}
			if (consumedChars === 0) {
				this.addTextToken(tokens, content.slice(index, startIndex + 1));
				consumedChars = 1;
			}

			index = startIndex + consumedChars;
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

		while (index < tokens.length) {
			const token = tokens[index]!;
			let attributes: Record<string, string | string[] | number> | undefined;

			if (token.type === 'MATH') {
				index++;
				continue;
			}
			if (['BR', 'WBR'].includes(token.type)) {
				node.children.push(new InlineNode(token.type as 'BR' | 'WBR'));
				index++;
			} else if (token.type === 'BRACKET' && token.positions?.has('start')) {
				const closeTokenIndex = findCloseBracketIndexInRange(tokens, index + 1);
				if (closeTokenIndex !== undefined
					&& tokens[index + 1]?.type === 'BRACKET' && tokens[index + 1]?.text?.[0] === '['
					&& tokens[closeTokenIndex - 1]?.type === 'BRACKET' && tokens[closeTokenIndex - 1]?.text?.[0] === ']'
				) {
					let newNode = new InlineNode(
						'KEY',
						{tokens: tokens.slice(index + 2, closeTokenIndex - 1), attributes},
					);
					const joinerIndices = findIndicesInRange<InlineToken>(
						tokens, (t) => t.type === 'KEY_JOINER', index + 2, closeTokenIndex - 1,
					);
					if (joinerIndices.length > 0) {
						newNode = new InlineNode(
							'KBD',
							{children: [], attributes},
						);
						let subindex = index + 2;
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
								tokens: tokens.slice(subindex, closeTokenIndex - 1),
								attributes,
							},
						));
					}
					node.children.push(newNode);
					index = closeTokenIndex + 1;
					continue;
				} else if (closeTokenIndex !== undefined
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
				} else if (closeTokenIndex !== undefined && tokens[index - 2]?.type === 'INLINE_OTHER' && inlineOtherElements.includes(tokens[index - 1]?.text ?? '')) {
					const subtype = tokens[index - 1]!.text!;
					let defaultAttributes = {};
					if (tokens[closeTokenIndex]!.defaultAttribute) {
						if (subtype === 'bdo') defaultAttributes = {dir: tokens[closeTokenIndex]!.defaultAttribute};
						else if (subtype === 'data') defaultAttributes = {value: tokens[closeTokenIndex]!.defaultAttribute};
						else if (subtype === 'time') defaultAttributes = {datetime: tokens[closeTokenIndex]!.defaultAttribute};
					}
					const newNode = new InlineNode('INLINE_OTHER', {
						subtype,
						tokens: tokens.slice(index + 1, closeTokenIndex),
						attributes: {...defaultAttributes, ...parseAttributes(tokens[closeTokenIndex]!.attributes)},
					});
					if (node.children.at(-1)) node.children.at(-1)!.content = node.children.at(-1)!.content!.slice(0, -subtype.length - 1);
					node.children.push(newNode);
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
				const rowspan = tokens[index + 1]?.type === 'SUP';
				let colspan = 1;
				while (tokens[index + colspan + (rowspan ? 1 : 0)]?.type === 'KBD') colspan++;
				if (node.children.length === 0) {
					this.currentTableRows.push([]);
				}
				const currentCellIndex = this.currentTableRows.at(-1)?.length ?? 0;
				if (tokens[index + (rowspan ? 1 : 0) + colspan]?.text) tokens[index + (rowspan ? 1 : 0) + colspan]!.text = tokens[index + (rowspan ? 1 : 0) + colspan]!.text!.trimStart();
				if (tokens[nextCellTokenIndex - 1]?.text) tokens[nextCellTokenIndex - 1]!.text = tokens[nextCellTokenIndex - 1]!.text!.trimEnd();
				let attributes = parseAttributes(token.attributes);
				if (rowspan) {
					let originCell: Node | null = null;
					let i = 2;
					while (originCell === null && this.currentTableRows[this.currentTableRows.length - i]) {
						originCell = this.currentTableRows[this.currentTableRows.length - i]?.[currentCellIndex] ?? null;
						i++;
					}
					if (originCell) {
						originCell.attributes = {...originCell.attributes, rowspan: (originCell.attributes?.rowspan ?? 1) as number + 1};
						attributes = {'data-in-rowspan': 'true'};
					}
				}
				const newNode = new InlineNode(token.type as InlineNodeType, {
					tokens: tokens.slice(index + (rowspan ? 1 : 0) + colspan, nextCellTokenIndex),
					attributes: colspan > 1 ? {colspan, ...attributes} : attributes,
				});
				this.currentTableRows[this.currentTableRows.length - 1]!.push(newNode);
				for (let i = 0; i < colspan - 1; i++) this.currentTableRows[this.currentTableRows.length - 1]!.push(null);
				node.children.push(newNode);
				index = nextCellTokenIndex;
			} else if (token.type === 'IMAGE') {
				index++;
			} else if (token.positions?.has('start')) {
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
							if (tokens[newTokenIndex]!.positions?.has('end') && newTokenIndex >= startIndex) {
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
						tokens, (t) => t.type === token.type && t.positions?.has('end'), index + 1,
					);
				}
				if (closeTokenIndex !== undefined && closeTokenIndex - index > 1) { // close token found
					if (tokens[closeTokenIndex]!.attributes) {
						attributes = parseAttributes(tokens[closeTokenIndex]!.attributes);
					}
					if (token.type === 'DFN' && tokens[closeTokenIndex]!.defaultAttribute) {
						attributes = {
							title: tokens[closeTokenIndex]!.defaultAttribute!,
							...attributes,
						};
					}
					let newNode = new InlineNode(
						token.type as InlineNodeType,
						{tokens: tokens.slice(index + 1, closeTokenIndex), attributes},
					);
					if (tokens[index + 1]?.type === 'BRACKET' && tokens[index + 1]!.positions?.has('start')
						&& tokens[closeTokenIndex - 1]?.type === 'BRACKET' && tokens[closeTokenIndex - 1]!.positions?.has('end')) {
						newNode.tokens = tokens.slice(index + 2, closeTokenIndex - 1);
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
						if (tokens[index + 1]!.type === 'BRACKET' && tokens[index + 1]!.positions?.has('start')
							&& tokens[closeTokenIndex - 1]!.type === 'BRACKET' && tokens[closeTokenIndex - 1]!.positions?.has('end')
						) {
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
