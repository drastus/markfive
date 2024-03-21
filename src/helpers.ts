const attributeRegexString = '(?:(?:data-)?[a-z]+(?:=(?:\\w+|"[^"]*"|\'[^\']*\'))?|\\.[^ \\t{}]+|#[^ \\t{}]+)';
export const attributesRegexString = `(?:{(${attributeRegexString}(?: ${attributeRegexString})*)})?`;

export const parseAttributes = (attributesString: string) => {
	const attributes: Record<string, string | string[]> = {};
	if (!attributesString) return attributes;

	console.log('attributesString', attributesString);
	const attributesArray: string[] = [];
	const attributeRegex = new RegExp(attributeRegexString, 'g');
	let match: RegExpMatchArray | null = null;
	while (match = attributeRegex.exec(attributesString)) {
		attributesArray.push(match[0]);
	}
	console.log('attributesArray', attributesArray);

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
				if (attributeValue[0] === '"' || attributeValue[0] === "'") {
					attributeValue = attributeValue.substring(1, attributeValue.length - 1);
				}
				attributes[attributeName] = attributeValue;
			} else {
				attributes[attribute] = '';
			}
		}
	});
	return attributes;
}
