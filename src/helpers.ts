const attributeRegexString = '(?:(?:data-)?[a-z]+(?:=(?:\\w+|"[^"]*"|\'[^\']*\'))?|\\.[^ \\t{}]+|#[^ \\t{}]+)';
export const attributesRegexString = `(?:{(${attributeRegexString}(?: ${attributeRegexString})*)})?`;

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

export const calculateIndent = (indent: string) => {
	const tabsCount = indent.split('\t').length - 1;
	if (tabsCount > 0) {
		return tabsCount;
	} else {
		return indent.split(' ').length - 1;
	}
};
