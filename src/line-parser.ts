/* eslint-disable no-useless-return */
import BlockNode from './block-node';
import {parseAttributes, trimIndent} from './helpers';
import {markfiveMathToMathML} from './math-parser';
import {type Options, type LineToken, type Node, type BlockNodeType} from './types';

const isNestingAllowed = (parentNodeType: BlockNodeType, nodeType: BlockNodeType) => {
	const allowedNestings: Partial<Record<BlockNodeType, BlockNodeType[]>> = {
		PARAGRAPH: ['LINE'],
		ORDERED_LIST: ['LIST_ITEM'],
		UNORDERED_LIST: ['LIST_ITEM'],
		DESCRIPTION_LIST: ['DESCRIPTION_LIST_ITEM'],
		TABLE: ['TABLE_ROW'],
		TABLE_ROW: ['TABLE_CELL'],
		BLOCK_CODE: ['LINE'],
		BLOCK_KBD: ['LINE'],
		BLOCK_SAMP: ['LINE'],
		COMMENT: ['LINE'],
	};
	if (allowedNestings[parentNodeType]) {
		return allowedNestings[parentNodeType].includes(nodeType);
	}
	return true;
};

class LineParser {
	tokens: LineToken[];
	current: number;
	indentStack: number[];
	preIndent: number;
	ast: Node;
	lastAttributes?: string;
	options: Options;

	constructor(tokens: LineToken[], options: Options) {
		this.tokens = tokens;
		this.current = 0;
		this.indentStack = [];
		this.preIndent = 0;
		this.ast = new BlockNode('DOCUMENT');
		this.options = options;
	}

	activeNode = () => {
		let node = this.ast;
		let depth = 0;
		while (depth < this.indentStack.length) {
			node = node.children[node.children.length - 1]!;
			depth++;
		}
		return node as BlockNode;
	};

	prevToken = () => this.tokens[this.current - 1]!;

	isOpenPosition = () => {
		if (this.current === 0) return true;
		if (['BLOCK_CODE', 'COMMENT'].includes(this.activeNode().type) && (this.tokens[this.current]?.indent ?? 0) > this.indentStack.at(-1)!) {
			return false;
		}
		if (this.prevToken().type === 'EMPTY_LINE') {
			return true;
		} else if (this.prevToken().type === 'LINE_WITH_LIST_ITEM_MARK' && !this.prevToken().text) {
			return true;
		} else if (this.prevToken().type === 'LINE_WITH_BLOCK_QUOTE_MARK' && !this.prevToken().text) {
			return true;
		} else if (this.prevToken().type === 'LINE_WITH_DIV_MARK' && !this.prevToken().text) {
			return true;
		} else if (this.prevToken().type === 'LINE_WITH_BLOCK_OTHER_MARK' && this.prevToken().marker !== 'pre') {
			return true;
		} else if (this.prevToken().type === 'LINE_WITH_ATTRIBUTES') {
			if (this.tokens[this.current - 2]!.type === 'EMPTY_LINE' || this.tokens[this.current - 2] === undefined) {
				return true;
			}
		}
		return false;
	};

	checkForAttributes = () => {
		if (this.lastAttributes) {
			const attributes = parseAttributes(this.lastAttributes);
			this.lastAttributes = undefined;
			return attributes;
		}
	};

	adaptIndentStack = (indent = 0) => {
		if (indent < this.indentStack.at(-1)!) {
			const newIndentStackEnd = (this.indentStack.findIndex((i) => i >= indent) ?? 0) + 1;
			this.indentStack = this.indentStack.slice(0, newIndentStackEnd);
			if (['BLOCK_QUOTE', 'DIV', 'DESCRIPTION_LIST', 'BLOCK_OTHER'].includes(this.activeNode().type)) {
				this.indentStack.pop();
			}
		}
	};

	addNode = (node: BlockNode, indent = 0, options: {cantHaveChildLines?: boolean, skipIndentAdapting?: boolean} = {}) => {
		if (this.options.debug) console.log('adding node in active node', this.activeNode().type, 'with indent stack', this.indentStack);
		if (!options.skipIndentAdapting) this.adaptIndentStack(indent);

		let activeNode = this.activeNode();
		if (!isNestingAllowed(activeNode.type, node.type)) {
			this.indentStack.pop();
			activeNode = this.activeNode();
		}

		activeNode.children.push(node);
		if (!options.cantHaveChildLines) {
			this.indentStack.push(indent);
		}
		if (this.options.debug) console.log('       added node', node.type, 'with indent', indent, 'new indent stack', this.indentStack, 'new active node', this.activeNode().type);
	};

	addTextNode = (token: LineToken) => {
		let content: string;
		if (this.activeNode().type === 'BLOCK_CODE' || (this.activeNode().type === 'BLOCK_OTHER' && this.activeNode().subtype === 'pre')) {
			if (this.preIndent === 0) this.preIndent = token.indent!;
			content = trimIndent(token.line ?? '', this.preIndent);
		} else {
			content = token.line?.trim() ?? '';
		}

		if (this.isOpenPosition()) {
			this.addNode(
				new BlockNode('PARAGRAPH', {
					attributes: this.checkForAttributes(),
					children: [new BlockNode('LINE', {content})],
				}),
				token.indent,
			);
		} else {
			this.addNode(
				new BlockNode('LINE', {content}),
				token.indent,
				{cantHaveChildLines: true},
			);
		}
	};

	parse = () => {
		if (this.options.debug) console.log('LineParser parse');

		while (this.current < this.tokens.length) {
			this.parseToken();
			this.current++;
		}

		if (this.options['line-ast'] || this.options.debug) console.log(`${JSON.stringify(this.ast, null, 4)}\n`);
		return this.ast;
	};

	parseToken = () => {
		const token = this.tokens[this.current]!;

		if (['BLOCK_CODE', 'COMMENT'].includes(this.activeNode().type) && (token.indent ?? 0) > this.indentStack.at(-1)!) {
			this.addTextNode(token);
			return;
		}

		if (token.type === 'EMPTY_LINE') {
			const activeNode = this.activeNode();
			if (activeNode.type === 'TABLE') {
				this.indentStack.pop();
			} else if (activeNode.type === 'TABLE_ROW') {
				this.indentStack.pop();
				this.indentStack.pop();
			} else if (activeNode.type === 'BLOCK_CODE') {
				this.addNode(
					new BlockNode('LINE'),
					token.indent,
					{cantHaveChildLines: true},
				);
			}
			return;
		}

		if (token.type === 'LINE_WITH_ATTRIBUTES') {
			if (!this.tokens[this.current + 1] || this.tokens[this.current + 1]!.type !== 'EMPTY_LINE') {
				this.lastAttributes = token.attributes; // lastAttributes later taken as attrs or as a text node by addNewNode
			} else if (this.current === 0 && this.tokens[this.current + 1]!.type === 'EMPTY_LINE') {
				this.activeNode().attributes = parseAttributes(token.attributes);
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'LINE_WITH_SEPARATOR_MARK') {
			if (this.isOpenPosition()) {
				if (this.tokens[this.current + 1]?.type === 'EMPTY_LINE') {
					this.addNode(
						new BlockNode('SEPARATOR', {attributes: this.checkForAttributes()}),
						token.indent,
						{cantHaveChildLines: true},
					);
					this.current++;
				} else {
					this.addNode(
						new BlockNode('PARAGRAPH', {attributes: this.checkForAttributes()}),
						token.indent,
						{cantHaveChildLines: true},
					);
				}
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'LINE_WITH_HEADING_MARK') {
			if (this.isOpenPosition()) {
				if (this.tokens[this.current + 1]?.type === 'EMPTY_LINE' || (
					this.tokens[this.current + 1]?.type === 'TEXT_LINE' && this.tokens[this.current + 2]?.type === 'EMPTY_LINE'
				)) {
					this.indentStack = [];
					this.addNode(
						new BlockNode('HEADING', {
							subtype: token.level!.toString(),
							attributes: this.checkForAttributes(),
							content: token.text,
							subcontent: this.tokens[this.current + 1]?.type === 'TEXT_LINE' ? this.tokens[this.current + 1]!.text : undefined,
						}),
						token.indent,
						{cantHaveChildLines: true},
					);
					this.current++;
				} else {
					this.addNode(
						new BlockNode('PARAGRAPH', {attributes: this.checkForAttributes()}),
						token.indent,
						{cantHaveChildLines: true},
					);
				}
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'TEXT_LINE') {
			this.addTextNode(token);
			return;
		}

		if (token.type === 'LINE_WITH_LIST_ITEM_MARK') {
			const listType = token.marker === '-' ? 'UNORDERED_LIST' : 'ORDERED_LIST';
			if ((token.indent ?? 0) > this.indentStack.at(-1)!) { // new subitem
				this.addNode(new BlockNode(listType, {attributes: this.checkForAttributes()}), token.indent);
			} else if ((token.indent ?? 0) === this.indentStack.at(-1)! && this.prevToken().type === 'EMPTY_LINE') { // new list
				this.addNode(new BlockNode(listType, {attributes: this.checkForAttributes()}), token.indent);
			} else {
				this.adaptIndentStack(token.indent);
				if (!['ORDERED_LIST', 'UNORDERED_LIST'].includes(this.activeNode().type)) { // new list
					this.addNode(
						new BlockNode(listType, {attributes: this.checkForAttributes()}),
						token.indent,
						{skipIndentAdapting: true},
					);
				}
			}
			const cantHaveChildLines = (this.tokens[this.current + 1]?.indent ?? 0) <= (token.indent ?? 0);
			this.addNode( // new item
				new BlockNode('LIST_ITEM', {
					subtype: token.marker,
					content: cantHaveChildLines ? token.text : undefined,
					attributes: parseAttributes(token.attributes),
				}),
				token.indent,
				{cantHaveChildLines, skipIndentAdapting: true},
			);
			if (!cantHaveChildLines && token.text) {
				this.addNode(new BlockNode('LINE', {content: token.text}), token.indent, {cantHaveChildLines: true, skipIndentAdapting: true});
			}
			return;
		}

		if (token.type === 'LINE_WITH_DESCRIPTION_LIST_ITEM_MARK') {
			this.adaptIndentStack(token.indent);
			if (
				this.activeNode().type !== 'DESCRIPTION_LIST'
				|| ((token.indent ?? 0) === this.indentStack.at(-1)! && this.isOpenPosition())
			) {
				this.addNode(
					new BlockNode('DESCRIPTION_LIST', {attributes: this.checkForAttributes()}),
					token.indent,
					{skipIndentAdapting: true},
				);
			}
			this.addNode(
				new BlockNode('DESCRIPTION_LIST_ITEM', {
					subtype: token.marker,
					content: token.text,
					attributes: parseAttributes(token.attributes),
				}),
				token.indent,
				{cantHaveChildLines: true, skipIndentAdapting: true},
			);
		}

		if (token.type === 'LINE_WITH_FINAL_COLON') {
			if (this.tokens[this.current + 1]
				&& (this.tokens[this.current + 1]!.indent ?? 0) > (token.indent ?? 0)
				&& !['BLOCK_CODE', 'BLOCK_KBD', 'BLOCK_SAMP'].includes(this.activeNode().type)
			) {
				if (
					this.activeNode().type !== 'DESCRIPTION_LIST'
					|| ((token.indent ?? 0) === this.indentStack.at(-1)! && this.isOpenPosition())
				) {
					this.addNode(
						new BlockNode('DESCRIPTION_LIST', {attributes: this.checkForAttributes()}),
						token.indent,
					);
				}
				this.addNode(
					new BlockNode('DESCRIPTION_LIST_ITEM', {
						subtype: ':',
						content: token.text,
					}),
					token.indent,
					{cantHaveChildLines: true},
				);
				this.addNode(
					new BlockNode('DESCRIPTION_LIST_ITEM', {
						subtype: '=',
						content: this.tokens[this.current + 1]!.text,
					}),
					token.indent,
					{cantHaveChildLines: true},
				);
				this.current++;
			} else {
				this.addTextNode(token);
			}
		}

		if (token.type === 'LINE_WITH_BLOCK_QUOTE_MARK') {
			if ((this.tokens[this.current + 1]?.indent ?? 0) > (token.indent ?? 0)) {
				this.addNode(
					new BlockNode('BLOCK_QUOTE', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
			} else { // single-line
				this.addNode(
					new BlockNode('BLOCK_QUOTE', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
				this.addNode(
					new BlockNode('PARAGRAPH', {
						attributes: this.checkForAttributes(),
						children: [new BlockNode('LINE', {content: token.text})],
					}),
					token.indent,
					{cantHaveChildLines: true},
				);
				this.indentStack.pop();
				this.indentStack.pop();
			}
			return;
		}

		if (token.type === 'LINE_WITH_BLOCK_CODE_MARK') {
			if ((this.tokens[this.current + 1]?.indent ?? 0) > (token.indent ?? 0)) {
				this.addNode(
					new BlockNode('BLOCK_CODE', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
				this.preIndent = 0;
			} else { // single-line
				this.addNode(
					new BlockNode('BLOCK_CODE', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
				this.addNode(
					new BlockNode('LINE', {content: token.text}),
					token.indent,
					{cantHaveChildLines: true},
				);
				this.indentStack.pop();
				this.indentStack.pop();
			}
			return;
		}

		if (token.type === 'LINE_WITH_BLOCK_KBD_MARK') {
			if (this.activeNode().type !== 'BLOCK_KBD') {
				this.addNode(
					new BlockNode('BLOCK_KBD', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
			}
			this.addNode(
				new BlockNode('LINE', {content: token.text}),
				token.indent,
				{cantHaveChildLines: true},
			);
			return;
		}

		if (token.type === 'LINE_WITH_BLOCK_SAMP_MARK') {
			if (this.activeNode().type !== 'BLOCK_SAMP') {
				this.addNode(
					new BlockNode('BLOCK_SAMP', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
			}
			this.addNode(
				new BlockNode('LINE', {content: token.text}),
				token.indent,
				{cantHaveChildLines: true},
			);
			return;
		}

		if (token.type === 'LINE_WITH_DIV_MARK') {
			if ((this.tokens[this.current + 1]?.indent ?? 0) > (token.indent ?? 0)) {
				this.addNode(
					new BlockNode('DIV', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'LINE_WITH_TABLE_ROW_MARK') {
			// add this.checkForAttributes()
			if (this.activeNode().type !== 'TABLE') {
				this.addNode(
					new BlockNode('TABLE'),
					token.indent,
				);
			}
			this.addNode(
				new BlockNode('TABLE_ROW', {
					content: token.text,
					attributes: parseAttributes(token.attributes),
				}),
				token.indent,
				{cantHaveChildLines: true},
			);
			return;
		}

		if (token.type === 'LINE_WITH_TABLE_ROW_SEPARATOR_MARK') {
			// add this.checkForAttributes()
			if (this.activeNode().type !== 'TABLE' && this.activeNode().type !== 'TABLE_ROW') {
				this.addNode(new BlockNode('TABLE'), token.indent);
			}
			this.addNode(
				new BlockNode('TABLE_ROW', {
					attributes: parseAttributes(token.attributes),
				}),
				token.indent,
			);
			return;
		}

		if (token.type === 'LINE_WITH_TABLE_CELL_MARK') {
			// add this.checkForAttributes()
			if (this.activeNode().type !== 'TABLE' && this.activeNode().type !== 'TABLE_ROW') {
				this.addNode(
					new BlockNode('TABLE'),
					token.indent,
				);
				this.addNode(
					new BlockNode('TABLE_ROW', {
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
			}
			this.addNode(
				new BlockNode('TABLE_CELL', {
					subtype: token.marker,
					content: token.text,
					attributes: parseAttributes(token.attributes),
				}),
				token.indent,
				{cantHaveChildLines: true},
			);
			return;
		}

		if (token.type === 'LINE_WITH_MATH_MARK') {
			this.addNode(
				new BlockNode('BLOCK_MATH', {
					content: markfiveMathToMathML(token.text!, true, this.options.debug),
				}),
				token.indent,
				{cantHaveChildLines: true},
			);
			return;
		}

		if (token.type === 'LINE_WITH_BLOCK_OTHER_MARK') {
			if ((this.tokens[this.current + 1]?.indent ?? 0) > (token.indent ?? 0)) {
				this.addNode(
					new BlockNode('BLOCK_OTHER', {
						subtype: token.marker,
						attributes: parseAttributes(token.attributes),
					}),
					token.indent,
				);
				this.preIndent = 0;
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'LINE_WITH_COMMENT_MARK') {
			if ((this.tokens[this.current + 1]?.indent ?? 0) > (token.indent ?? 0)) {
				this.addNode(
					new BlockNode('COMMENT'),
					token.indent,
				);
			} else { // single-line
				this.addNode(
					new BlockNode('COMMENT', {
						children: [new BlockNode('LINE', {content: token.text})],
					}),
					token.indent,
				);
				this.indentStack.pop();
			}
			return;
		}
	};
}

export default LineParser;
