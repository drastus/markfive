/* eslint-disable no-useless-return */
import BlockNode from './block-node';
import {calculateIndent, parseAttributes} from './helpers';
import {markfiveMathToMathML} from './math-parser';
import {type Options, type LineToken, type Node} from './types';

class LineParser {
	tokens: LineToken[];
	current: number;
	indentStack: number[];
	ast: Node;
	lastAttributes?: string;
	options: Options;

	constructor(tokens: LineToken[], options: Options) {
		this.tokens = tokens;
		this.current = 0;
		this.indentStack = [];
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
		return node;
	};

	prevToken = () => this.tokens[this.current - 1]!;

	isOpenPosition = () => {
		if (this.current === 0) return true;
		if (this.prevToken().type === 'EMPTY_LINE') {
			return true;
		} else if (this.prevToken().type === 'LINE_WITH_LIST_ITEM_MARK' && !this.prevToken().text) {
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

	increasedIndent = (indent = '') => {
		const newIndent = calculateIndent(indent);
		return newIndent > this.indentStack[this.indentStack.length - 1]!;
	};

	updateIndentStack = (node: BlockNode, indent: number) => {
		const activeNode = this.activeNode();
		const isSubnodeOfListItem = (
			indent > this.indentStack[this.indentStack.length - 1]!
				&& this.prevToken().type === 'LINE_WITH_LIST_ITEM_MARK'
				&& !this.prevToken().text
		);

		if (['PARAGRAPH', 'BLOCK_CODE', 'BLOCK_QUOTE'].includes(activeNode.type) && node.type !== 'LINE') {
			this.indentStack.pop();
		}
		if (['ORDERED_LIST', 'UNORDERED_LIST'].includes(activeNode.type) && !['LIST_ITEM', 'ORDERED_LIST', 'UNORDERED_LIST'].includes(node.type) && !isSubnodeOfListItem) {
			this.indentStack.pop();
		}
		if (activeNode.type === 'TABLE' && node.type !== 'TABLE_ROW') {
			this.indentStack.pop();
		}
		if (activeNode.type === 'TABLE_ROW' && node.type !== 'TABLE_CELL') {
			this.indentStack.pop();
		}
		if (node.type === 'HEADING') {
			this.indentStack = [];
		}

		if (indent < this.indentStack[this.indentStack.length - 1]!) {
			const newIndentStackEnd = this.indentStack.findIndex((i) => i >= indent);
			this.indentStack = this.indentStack.slice(0, newIndentStackEnd + 1);
		} else if (isSubnodeOfListItem) {
			this.indentStack.push(indent);
		}
	};

	addNode = (node: BlockNode, indent = '', forcePushToIndentStack = false) => {
		const newIndent = calculateIndent(indent);
		this.updateIndentStack(node, newIndent);

		const activeNode = this.activeNode();

		activeNode.children.push(node);
		if (this.options.debug) console.log('addNode', this.indentStack, activeNode.type, ' > ', node.type);

		if (['PARAGRAPH', 'UNORDERED_LIST', 'ORDERED_LIST', 'BLOCK_QUOTE', 'BLOCK_CODE', 'TABLE'].includes(node.type)
			|| forcePushToIndentStack
		) {
			this.indentStack.push(newIndent);
		}
	};

	addTextNode = (token: LineToken) => {
		this.addNode(new BlockNode('LINE', {content: token.line!}), token.indent);
		// or new paragraph, if activeNode don't allow new text line
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
		let newActiveNode: BlockNode;

		if (token.type === 'EMPTY_LINE') {
			const activeNode = this.activeNode();
			if (activeNode.type === 'TABLE') {
				this.indentStack.pop();
			} else if (activeNode.type === 'TABLE_ROW') {
				this.indentStack.pop();
				this.indentStack.pop();
			}
			return;
		}

		if (token.type === 'LINE_WITH_ATTRIBUTES') {
			if (!this.tokens[this.current + 1] || this.tokens[this.current + 1]!.type !== 'EMPTY_LINE') {
				this.lastAttributes = token.attributes; // lastAttributes later taken as attrs or as a text node by addNewNode
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'LINE_WITH_SEPARATOR_MARK') {
			if (this.isOpenPosition()) {
				if (this.tokens[this.current + 1]?.type === 'EMPTY_LINE') {
					this.addNode(new BlockNode('SEPARATOR', {attributes: this.checkForAttributes()}));
					this.current++;
				} else {
					this.addNode(new BlockNode('PARAGRAPH', {attributes: this.checkForAttributes()}));
				}
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'LINE_WITH_HEADING_MARK') {
			if (this.isOpenPosition()) {
				if (this.tokens[this.current + 1]?.type === 'EMPTY_LINE') {
					this.addNode(
						new BlockNode('HEADING', {
							subtype: token.level!.toString(),
							attributes: this.checkForAttributes(),
							content: token.text,
						}),
					);
					this.current++;
				} else {
					this.addNode(new BlockNode('PARAGRAPH', {attributes: this.checkForAttributes()}));
				}
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'TEXT_LINE') {
			if (this.isOpenPosition()) { // include list items without any text
				this.addNode(
					new BlockNode('PARAGRAPH', {
						attributes: this.checkForAttributes(),
						children: [new BlockNode('LINE', {content: token.text})],
					}),
					token.indent,
				);
			} else {
				this.addTextNode(token);
			}
			return;
		}

		if (token.type === 'LINE_WITH_LIST_ITEM_MARK') {
			const listType = token.marker === '-' ? 'UNORDERED_LIST' : 'ORDERED_LIST';
			// add this.checkForAttributes()
			if (this.increasedIndent(token.indent)) {
				const newActiveNode = new BlockNode(listType);
				this.addNode(newActiveNode, token.indent);
			} else {
				const newIndent = calculateIndent(token.indent!);
				this.updateIndentStack(new BlockNode(listType), newIndent);
				if (!['ORDERED_LIST', 'UNORDERED_LIST'].includes(this.activeNode().type)) {
					this.addNode(new BlockNode(listType), token.indent);
				}
			}
			this.addNode(new BlockNode('LIST_ITEM', {
				subtype: token.marker,
				content: token.text,
				attributes: parseAttributes(token.attributes),
			}), token.indent);
			return;
		}

		if (token.type === 'LINE_WITH_BLOCK_QUOTE_MARK') { // for now only multi-line
			newActiveNode = new BlockNode('BLOCK_QUOTE', {
				attributes: parseAttributes(token.attributes),
			});
			this.addNode(newActiveNode, token.indent);
			return;
		}

		if (token.type === 'LINE_WITH_BLOCK_CODE_MARK') { // for now only multi-line
			newActiveNode = new BlockNode('BLOCK_CODE', {
				attributes: parseAttributes(token.attributes),
			});
			this.addNode(newActiveNode, token.indent);
			return;
		}

		if (token.type === 'LINE_WITH_TABLE_ROW_MARK') {
			// add this.checkForAttributes()
			if (this.activeNode().type !== 'TABLE') {
				this.addNode(new BlockNode('TABLE'), token.indent);
			}
			this.addNode(new BlockNode('TABLE_ROW', {
				content: token.text,
				attributes: parseAttributes(token.attributes),
			}), token.indent);
			return;
		}

		if (token.type === 'LINE_WITH_TABLE_ROW_SEPARATOR_MARK') {
			// add this.checkForAttributes()
			if (this.activeNode().type !== 'TABLE' && this.activeNode().type !== 'TABLE_ROW') {
				this.addNode(new BlockNode('TABLE'), token.indent);
			}
			newActiveNode = new BlockNode('TABLE_ROW', {
				attributes: parseAttributes(token.attributes),
			});
			this.addNode(newActiveNode, token.indent, true);
			return;
		}

		if (token.type === 'LINE_WITH_TABLE_CELL_MARK') {
			// add this.checkForAttributes()
			if (this.activeNode().type !== 'TABLE' && this.activeNode().type !== 'TABLE_ROW') {
				this.addNode(new BlockNode('TABLE'), token.indent);
				newActiveNode = new BlockNode('TABLE_ROW', {
					attributes: parseAttributes(token.attributes),
				});
				this.addNode(newActiveNode, token.indent, true);
			}
			this.addNode(new BlockNode('TABLE_CELL', {
				subtype: token.marker,
				content: token.text,
				attributes: parseAttributes(token.attributes),
			}), token.indent);
			return;
		}

		if (token.type === 'LINE_WITH_MATH_MARK') {
			this.addNode(new BlockNode('BLOCK_MATH', {
				content: markfiveMathToMathML(token.text!, true, this.options.debug),
			}), token.indent);
			return;
		}
	};
}

export default LineParser;
