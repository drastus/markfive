import type {InlineToken} from './types';

const attributeRegexString = '(?:(?:data-)?[a-z]+(?:=(?:\\w+|"[^"]*"|\'[^\']*\'))?|\\.[^ \\t{}]+|#[^ \\t{}]+)';
export const attributesRegexString = `(?:{(${attributeRegexString}(?: ${attributeRegexString})*)})?`;
export const defaultAttributeRegexString = '\\(([^()]*(\\([^()]+\\))?[^()]*)\\)';

export const parseAttributes = (attributesString?: string) => {
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

export const stringifyAttributes = (attributes?: Record<string, string | string[]>) => {
	let string = '';
	if (!attributes) return string;
	for (const [attributeName, attributeValue] of Object.entries(attributes)) {
		const value = Array.isArray(attributeValue) ? attributeValue.join(' ') : attributeValue;
		string += ` ${attributeName}="${value}"`;
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

export const createHeadingRef = (text: string) => text.toLowerCase()
	.replace(/\{\/\}/gu, '_')
	.replace(/\s+/gu, '_')
	.replace(/[^\p{L}\d_-]/gu, '');
