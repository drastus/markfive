import {type Options, type Node} from './types';

const DEFAULT_LANG = 'en';

const langSubtag = (lang: string): string => lang.split('-')[0]!;

const doubleQuotes: Record<'standard' | 'low' | 'lowReversed' | 'right', [string, string]> = {
	standard: ['“', '”'],
	low: ['„', '“'],
	lowReversed: ['„', '“'],
	right: ['”', '”'],
};

const singleQuotes: Record<'standard' | 'reversed' | 'low' | 'lowReversed' | 'right', [string, string]> = {
	standard: ['‘', '’'],
	reversed: ['’', '‘'],
	low: ['‚', '’'],
	lowReversed: ['‚', '‘'],
	right: ['’', '’'],
};

const getDoubleQuotes = (lang: string): [string, string] => {
	switch (langSubtag(lang)) {
		case 'el':
		case 'en':
		case 'es':
		case 'it':
		case 'pt':
		case 'tr':
			return doubleQuotes.standard;
		case 'cnr':
		case 'hbs':
		case 'he':
		case 'hr':
		case 'hu':
		case 'nl':
		case 'pl':
		case 'ro':
		case 'sr':
			return doubleQuotes.low;
		case 'be':
		case 'bg':
		case 'cs':
		case 'da':
		case 'de':
		case 'ee':
		case 'is':
		case 'ka':
		case 'lt':
		case 'no':
		case 'ru':
		case 'sk':
		case 'sl':
		case 'sq':
			return doubleQuotes.lowReversed;
		case 'bs':
		case 'fi':
		case 'sv':
			return doubleQuotes.right;
		default:
			return doubleQuotes.standard;
	}
};

const getSingleQuotes = (lang: string): [string, string] => {
	switch (langSubtag(lang)) {
		case 'en':
		case 'es':
		case 'it':
		case 'pl':
		case 'pt':
		case 'tr':
			return singleQuotes.standard;
		case 'mk':
			return singleQuotes.reversed;
		case 'he':
		case 'nl':
			return singleQuotes.low;
		case 'cs':
		case 'da':
		case 'de':
		case 'is':
		case 'lt':
		case 'no':
		case 'sk':
		case 'sl':
			return singleQuotes.lowReversed;
		case 'bg':
		case 'bs':
		case 'cnr':
		case 'fi':
		case 'hu':
		case 'sr':
		case 'sv':
			return singleQuotes.right;
		default:
			return singleQuotes.standard;
	}
};

const usesSpacing = (lang: string): boolean => {
	if (lang.startsWith('fr-CH')) return false;
	return langSubtag(lang) === 'fr';
};

const hasReversedSingleGuillemets = (lang: string): boolean => {
	if (lang.startsWith('de-CH')) return false;
	return ['cs', 'da', 'de', 'sk', 'sl'].includes(langSubtag(lang));
};

class Typography {
	ast: Node;
	options: Options;
	prevChar: string;
	openDoubleQuotes: Array<{node: Node, position: number}>;
	openSingleQuotes: Array<{node: Node, position: number}>;

	excludedTypes = ['BLOCK_CODE', 'CODE', 'KBD', 'SAMP', 'BLOCK_MATH', 'INLINE_MATH'];

	constructor(ast: Node, options: Options) {
		this.ast = ast;
		this.options = options;
		this.prevChar = '';
		this.openDoubleQuotes = [];
		this.openSingleQuotes = [];
	}

	parse = () => {
		if (this.options.debug) console.log('Typography parse\n');
		this.processNode(this.ast, (this.ast.attributes?.lang as string | undefined) ?? DEFAULT_LANG);
		return this.ast;
	};

	private processNode(node: Node, lang: string) {
		if (this.options.debug) console.log(`processNode ${node.type} ${node.content ?? ''}`);
		if (this.excludedTypes.includes(node.type)) {
			return;
		}
		if (['PARAGRAPH', 'HEADING', 'LIST_ITEM', 'TABLE_CELL'].includes(node.type)) {
			this.prevChar = '';
			this.openDoubleQuotes = [];
			this.openSingleQuotes = [];
		}
		if (node.type === 'TEXT') {
			this.processText(node, lang);
		}
		if ('children' in node && Array.isArray(node.children)) {
			for (const child of node.children) {
				this.processNode(child, (child.attributes?.lang as string | undefined) ?? lang);
			}
		}
	}

	private processText(node: Node, lang: string) {
		const text = node.content!;
		let modifiedText = '';
		let index = 0;
		let currentPosition = 0;
		while (index < text.length) {
			const char = text[index]!;
			const prevIsWhitespace = /^(\p{Z})/u.test(text[index - 1] ?? this.prevChar);
			const nextIsWhitespace = /^(\p{Z})/u.test(text[index + 1] ?? ' ');
			const prevIsAlphanumeric = /^(\p{L}|\p{M}|\p{N})/u.test(text[index - 1] ?? this.prevChar);
			const nextIsAlphanumeric = /^(\p{L}|\p{M}|\p{N})/u.test(text[index + 1] ?? ' ');
			if (char === '"') {
				modifiedText += getDoubleQuotes(lang)[1]; // closing
				if (prevIsWhitespace || this.prevChar === '') {
					this.openDoubleQuotes.push({node, position: currentPosition});
				} else {
					if (this.openDoubleQuotes.at(-1)) {
						const {node: openingQuoteNode, position} = this.openDoubleQuotes.at(-1)!;
						if (openingQuoteNode === node) {
							modifiedText = modifiedText.slice(0, position) + getDoubleQuotes(lang)[0] + modifiedText.slice(position + 1);
						} else {
							openingQuoteNode.content = openingQuoteNode.content!.slice(0, position) + getDoubleQuotes(lang)[0] + openingQuoteNode.content!.slice(position + 1);
						}
						this.openDoubleQuotes.pop();
					}
				}
			} else if (char === '\'') {
				if (text.slice(0, index + 1).match(/(?<![''])\d+'$/)) { // preceded by digits not preceded by an apostrophe
					const nextIsApostrophe = text[index + 1] === '\'';
					modifiedText += (nextIsApostrophe ? '″' : '′');
					index += nextIsApostrophe ? 1 : 0;
				} else {
					modifiedText += getSingleQuotes(lang)[1]; // closing
					if (prevIsWhitespace || this.prevChar === '') {
						this.openSingleQuotes.push({node, position: currentPosition});
					} else {
						if (this.openSingleQuotes.at(-1)) {
							const {node: openingQuoteNode, position} = this.openSingleQuotes.at(-1)!;
							if (openingQuoteNode === node) {
								modifiedText = modifiedText.slice(0, position) + getSingleQuotes(lang)[0] + modifiedText.slice(position + 1);
							} else {
								openingQuoteNode.content = openingQuoteNode.content!.slice(0, position) + getSingleQuotes(lang)[0] + openingQuoteNode.content!.slice(position + 1);
							}
							this.openSingleQuotes.pop();
						}
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
				modifiedText += `«${usesSpacing(lang) && !nextIsWhitespace ? ' ' : ''}`;
				index += 1;
			} else if (char === '>' && text[index + 1] === '>') {
				modifiedText += `${usesSpacing(lang) && !prevIsWhitespace ? ' ' : ''}»`;
				index += 1;
			} else if (char === '<' && (hasReversedSingleGuillemets(lang) ? !nextIsAlphanumeric : !prevIsAlphanumeric)) {
				modifiedText += `‹${usesSpacing(lang) && !nextIsWhitespace ? ' ' : ''}`;
			} else if (char === '>' && (hasReversedSingleGuillemets(lang) ? !prevIsAlphanumeric : !nextIsAlphanumeric)) {
				modifiedText += `${usesSpacing(lang) && !prevIsWhitespace ? ' ' : ''}›`;
			} else if (char === '[' && text[index + 1] === '<') {
				modifiedText += '⟨';
				index += 1;
			} else if (char === '>' && text[index + 1] === ']') {
				modifiedText += '⟩';
				index += 1;
			} else if (char === '?' && usesSpacing(lang) && !prevIsWhitespace) {
				modifiedText += ' ?';
			} else if (char === '!' && usesSpacing(lang) && !prevIsWhitespace) {
				modifiedText += ' !';
			} else if (char === ':' && usesSpacing(lang) && !prevIsWhitespace) {
				modifiedText += ' :';
			} else if (char === 'x' && text.slice(0, index + 3).match(/\d x \d$/)) {
				modifiedText += '×';
			} else {
				modifiedText += char;
			}
			if (index >= text.length - 1) {
				node.content = modifiedText;
			}
			this.prevChar = char;
			index += 1;
			currentPosition += 1;
		}
	}
}

export default Typography;
