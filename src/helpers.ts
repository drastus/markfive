import type {InlineToken} from './types';

const attributeRegexString = '(?:(?:data-)?[a-z]+(?:=(?:\\w+|"[^"]*"|\'[^\']*\'))?|\\.[^ \\t{}]+|#[^ \\t{}]+)';
export const attributesRegexString = `(?:{(${attributeRegexString}(?: ${attributeRegexString})*)})?`;
export const defaultAttributeRegexString = '\\(([^()]*(\\([^()]+\\))?[^()]*)\\)';

export const parseAttributes = (attributesString?: string): Record<string, string | string[] | number> | undefined => {
	if (attributesString === undefined) return undefined;

	const attributes: Record<string, string | string[]> = {};
	if (!attributesString) return attributes;

	const attributesArray: string[] = [];
	const attributeRegex = new RegExp(attributeRegexString, 'g');
	let match: RegExpMatchArray | null = null;
	while (match = attributeRegex.exec(attributesString)) {
		attributesArray.push(match[0]);
	}

	attributesArray.forEach((attribute) => {
		if (attribute.startsWith('#')) {
			attributes.id = attribute.substring(1);
		} else if (attribute.startsWith('.')) {
			const classes = attribute.split('.');
			attributes.class = classes.slice(1);
		} else {
			if (attribute.includes('=')) {
				const eqIndex = attribute.indexOf('=');
				const attributeName = attribute.substring(0, eqIndex);
				let attributeValue = attribute.substring(eqIndex + 1);
				if (attributeValue.startsWith('"') || attributeValue.startsWith('\'')) {
					attributeValue = attributeValue.substring(1, attributeValue.length - 1);
				}
				attributes[attributeName] = attributeValue;
			} else {
				attributes[attribute] = '';
			}
		}
	});
	return attributes;
};

export const stringifyAttributes = (attributes?: Record<string, string | string[] | number>) => {
	let string = '';
	if (!attributes) return string;
	for (const [attributeName, attributeValue] of Object.entries(attributes)) {
		let value: string | number | undefined;
		if (Array.isArray(attributeValue)) {
			value = attributeValue.length > 0 ? attributeValue.join(' ') : undefined;
		} else {
			value = String(attributeValue);
		}
		if (value !== undefined) {
			string += ` ${attributeName}="${value}"`;
		}
	}
	return string;
};

export const calculateIndent = (indent = '') => {
	const tabsCount = indent.split('\t').length - 1;
	if (tabsCount > 0) {
		return tabsCount;
	} else {
		return indent.split(' ').length - 1;
	}
};

export const trimIndent = (text: string, indent = 1) => (
	text.replace(new RegExp(`^(${' '.repeat(indent)}|${'\t'.repeat(indent)})`, 'gm'), '')
);

export const findIndexInRange = <T>(array: T[], predicate: (item: T) => unknown, from: number, to?: number) => {
	const index = array.slice(from).findIndex(predicate);
	if (index < 0) return undefined;
	if (to !== undefined && from + index > to) return undefined;
	return from + index;
};

export const findIndicesInRange = <T>(array: T[], predicate: (item: T) => unknown, from: number, to?: number) => {
	const indices: number[] = [];
	let index = findIndexInRange(array, predicate, from, to);
	while (index !== undefined) {
		indices.push(index);
		index = findIndexInRange(array, predicate, index + 1, to);
	}
	return indices;
};

export const findCloseBracketIndexInRange = (array: InlineToken[], from: number, to?: number) => {
	let balance = 1;
	let index = from;
	while (index < (to ?? array.length)) {
		const item = array[index];
		if (item) {
			if (item.type === 'BRACKET' && item.text?.[0] === '[') balance++;
			if (item.type === 'BRACKET' && item.text?.[0] === ']') balance--;
		}
		if (balance === 0) break;
		index++;
	}
	if (balance !== 0) return undefined;
	return index;
};

export const trimAndJoin = (array: string[]) => array
	.map((item) => item.trim())
	.join('\n');

export const variableNameRegexString = '[A-Za-z][A-Za-z0-9_]+';
const variableRegexString = `\\{\\{${variableNameRegexString}\\}\\}`;
const urlCharRegexString = `(?:[^\\s<>{}|]|${variableRegexString})`;
// a URL starts with a scheme or with a variable (whose value is checked later)
const urlRegex = new RegExp(
	`(?<![\\p{L}\\p{N}])(?:(?:(?:https?|ftp)://|mailto:)${urlCharRegexString}+|${variableRegexString}${urlCharRegexString}*)`,
	'gu',
);
const urlValidRegex = /^(?:(?:https?|ftp):\/\/|mailto:)[^\s<>"]+$/u;
const urlTrailingPunctuationRegex = /[.,;:!?'"`*_~=#]+$/u;
const urlClosingBrackets: Record<string, string> = {')': '(', ']': '['};
const urlWrappingMarkers = ['/', '--'];

// cuts the URL at the first unbalanced closing bracket and strips trailing punctuation
const trimUrl = (url: string) => {
	const depths: Record<string, number> = {'(': 0, '[': 0};
	let end = url.length;
	for (let i = 0; i < url.length; i++) {
		const char = url[i]!;
		if (char in depths) {
			depths[char]!++;
		} else if (char in urlClosingBrackets) {
			const opening = urlClosingBrackets[char]!;
			if (depths[opening] === 0) {
				end = i;
				break;
			}
			depths[opening]!--;
		}
	}
	return url.slice(0, end).replace(urlTrailingPunctuationRegex, '');
};

// strips a closing marker matching an opening one right before the URL, e.g. /https://example.com/
const stripWrappingMarker = (url: string, textBefore: string) => {
	for (const marker of urlWrappingMarkers) {
		if (url.endsWith(marker) && textBefore.endsWith(marker)
			&& !/[\p{L}\p{M}\p{N}\\]$/u.test(textBefore.slice(0, -marker.length))
		) {
			return url.slice(0, -marker.length);
		}
	}
	return url;
};

// returns the URL with variables replaced and the length of its source
export const findUrl = (text: string, from: number, data: Record<string, string>) => {
	urlRegex.lastIndex = from;
	let match: RegExpExecArray | null = null;
	while (match = urlRegex.exec(text)) {
		const textBefore = text.slice(Math.max(0, match.index - 3), match.index);
		const source = stripWrappingMarker(trimUrl(match[0]), textBefore);
		const url = source.replace(new RegExp(variableRegexString, 'g'), (variable) => data[variable.slice(2, -2)] ?? '');
		if (urlValidRegex.test(url)) return {index: match.index, length: source.length, text: url};
		urlRegex.lastIndex = match.index + 1;
	}
	return undefined;
};

export const createHeadingRef = (text: string) => text.toLowerCase()
	.replace(/\{\/\}/gu, '_')
	.replace(/\s+/gu, '_')
	.replace(/[^\p{L}\d_-]/gu, '');
