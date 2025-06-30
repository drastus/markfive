import {type Options, type Node} from './types';

class Typography {
	ast: Node;
	options: Options;
	prevChar: string;
	openDoubleQuotes: Array<{node: Node, position: number}>;
	openSingleQuotes: Array<{node: Node, position: number}>;

	constructor(ast: Node, options: Options) {
		this.ast = ast;
		this.options = options;
		this.prevChar = '';
		this.openDoubleQuotes = [];
		this.openSingleQuotes = [];
	}

	parse = () => {
		if (this.options.debug) console.log('Typography parse\n');
		this.processNode(this.ast);
		return this.ast;
	};

	private processNode(node: Node) {
		if (this.options.debug) console.log(`processNode ${node.type} ${node.content ?? ''}`);
		if (node.type === 'BLOCK_CODE' || node.type === 'CODE' || node.type === 'BLOCK_MATH' || node.type === 'INLINE_MATH') {
			return;
		}
		if (['PARAGRAPH', 'HEADING', 'LIST_ITEM', 'TABLE_CELL'].includes(node.type)) {
			this.prevChar = '';
			this.openDoubleQuotes = [];
			this.openSingleQuotes = [];
		}
		if (node.type === 'TEXT') {
			this.processText(node);
			if (this.options.debug) console.log(`double ${this.openDoubleQuotes.map((n) => n.node.content!).join('')}`);
			if (this.options.debug) console.log(`single ${this.openSingleQuotes.map((n) => n.node.content!).join('')}`);
		}
		if ('children' in node && Array.isArray(node.children)) {
			for (const child of node.children) {
				this.processNode(child);
			}
		}
	}

	private processText(node: Node) {
		const text = node.content!;
		let modifiedText = '';
		let index = 0;
		let currentPosition = 0;
		while (index < text.length) {
			const char = text[index]!;
			const prevIsWhitespace = /^(\p{Z})/u.test(text[index - 1] ?? this.prevChar);
			if (char === '"') {
				modifiedText += '”'; // closing
				if (prevIsWhitespace || this.prevChar === '') {
					this.openDoubleQuotes.push({node, position: currentPosition});
				} else {
					if (this.openDoubleQuotes.at(-1)) {
						const {node: openingQuoteNode, position} = this.openDoubleQuotes.at(-1)!;
						if (openingQuoteNode === node) {
							modifiedText = modifiedText.slice(0, position) + '“' + modifiedText.slice(position + 1);
						} else {
							openingQuoteNode.content = openingQuoteNode.content!.slice(0, position) + '“' + openingQuoteNode.content!.slice(position + 1);
						}
						this.openDoubleQuotes.pop();
					}
				}
			} else if (char === '\'') {
				modifiedText += '’'; // closing
				if (prevIsWhitespace || this.prevChar === '') {
					this.openSingleQuotes.push({node, position: currentPosition});
				} else {
					if (this.openSingleQuotes.at(-1)) {
						const {node: openingQuoteNode, position} = this.openSingleQuotes.at(-1)!;
						if (openingQuoteNode === node) {
							modifiedText = modifiedText.slice(0, position) + '‘' + modifiedText.slice(position + 1);
						} else {
							openingQuoteNode.content = openingQuoteNode.content!.slice(0, position) + '‘' + openingQuoteNode.content!.slice(position + 1);
						}
						this.openSingleQuotes.pop();
					}
				}
			} else if (char === '.' && text[index + 1] === '.' && text[index + 2] === '.') {
				modifiedText += '…';
				index += 2;
			} else if (char === '-' && text[index + 1] === '-' && text[index + 2] === '-') {
				modifiedText += '—'; // em dash
				index += 2;
			} else if (char === '-' && text[index + 1] === '-') {
				modifiedText += '–'; // en dash
				index += 1;
			} else if ((prevIsWhitespace || this.prevChar === '') && char === '-' && text[index + 1]?.match(/\d/)) {
				modifiedText += '−'; // minus
			} else if (char === '<' && text[index + 1] === '<') {
				modifiedText += '«';
				index += 1;
			} else if (char === '>' && text[index + 1] === '>') {
				modifiedText += '»';
				index += 1;
			// more sophisticated lang-dependent rules needed
			// } else if ((prevIsWhitespace || this.prevChar === '') && char === '<') {
			// 	modifiedText += '‹';
			// } else if ((prevIsWhitespace || this.prevChar === '') && char === '>') {
			// 	modifiedText += '‹';
			} else if (char === '(' && text[index + 1] === '<') {
				modifiedText += '⟨';
				index += 1;
			} else if (char === '>' && text[index + 1] === ')') {
				modifiedText += '⟩';
				index += 1;
			} else {
				modifiedText += char;
			}
			if (index === text.length - 1) {
				node.content = modifiedText;
			}
			this.prevChar = char;
			index += 1;
			currentPosition += 1;
		}
	}
}

export default Typography;
