import type BlockNode from './block-node';
import {attributesRegexString} from './helpers';

const specialChars = /[+*[\]{}"'`:~^!/_=-]/;

const commonTokens: Array<{chars: string, type: InlineTokenType}> = [
	{chars: '!!', type: 'B'},
	{chars: '//', type: 'I'},
	{chars: '__', type: 'U'},
	{chars: '~~', type: 'S'},
	{chars: '\'\'', type: 'CITE'},
	{chars: '+', type: 'EM'},
	{chars: '*', type: 'STRONG'},
	{chars: '=', type: 'MARK'},
	{chars: ':', type: 'DFN'},
	{chars: '~', type: 'VAR'},
	{chars: '`', type: 'CODE'},
];

class InlineLexer {
	ast: BlockNode;
	current: number;

	constructor(source: BlockNode) {
		this.ast = source;
		this.current = 0;
	}

	tokenize = () => {
		console.log('InlineLexer tokenize\n');

		this.tokenizeNode(this.ast);

		return this.ast;
	};

	tokenizeNode = (node: BlockNode) => {
		if (node.content) {
			node.tokens = this.getNodeTokens(node.content);
		}
		node.children.forEach((child) => {
			this.tokenizeNode(child);
		});
	};

	addTextToken = (tokens: InlineToken[], text: string) => {
		const lastToken = tokens[tokens.length - 1];
		if (lastToken?.type === 'TEXT') {
			lastToken.text += text;
		} else {
			tokens.push({type: 'TEXT', text});
		}
	};

	getNodeTokens = (content: string) => {
		const tokens: InlineToken[] = [];
		let index = 0;

		while (index < content.length) {
			const nextSpecialCharIndex = content.slice(index).search(specialChars);
			let position: 'start' | 'end' | undefined;
			let consumedChars = 0;
			let match: RegExpMatchArray | null = null;

			if (nextSpecialCharIndex < 0) {
				this.addTextToken(tokens, content.slice(index));
				index = content.length;
				break;
			}

			for (const {chars, type} of commonTokens) {
				if (content[index + nextSpecialCharIndex] === chars[0]) {
					if (chars.length === 2 && content[index + nextSpecialCharIndex + 1] !== chars[1]) {
						break;
					}
					if (nextSpecialCharIndex > 0) {
						this.addTextToken(tokens, content.slice(index, index + nextSpecialCharIndex));
					}

					consumedChars = chars.length;
					const prevIsLetter = /^\p{L}/u.test(content[index + nextSpecialCharIndex - 1] ?? '');
					const nextIsLetter = /^\p{L}/u.test(content[index + nextSpecialCharIndex + consumedChars] ?? '');
					if (prevIsLetter && nextIsLetter) {
						this.addTextToken(tokens, content.slice(
							index + nextSpecialCharIndex,
							index + nextSpecialCharIndex + consumedChars,
						));
					} else {
						if (prevIsLetter) {
							position = 'end';
						} else if (nextIsLetter) {
							position = 'start';
						}
						const newToken: InlineToken = {
							type,
							position,
							text: content.slice(index + nextSpecialCharIndex, index + nextSpecialCharIndex + consumedChars),
						};
						const contentRest = content.slice(index + nextSpecialCharIndex + consumedChars);
						if (position !== 'start') {
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
}

export default InlineLexer;
