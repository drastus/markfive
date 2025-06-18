import BlockNode from './block-node';
import {stringifyAttributes, trimAndJoin} from './helpers';
import type {Node, Options} from './types';

const elementMappings: Record<string, string> = {
	PARAGRAPH: 'p',
	ORDERED_LIST: 'ol',
	UNORDERED_LIST: 'ul',
	LIST_ITEM: 'li',
	TABLE_ROW: 'tr',
	SEPARATOR: 'hr',
};
const tableCellElementMappings: Record<string, string> = {
	'|': 'td',
	'!': 'th',
};
const mainBlockElements = ['body', 'table', 'tr', 'ol', 'ul'];

class Renderer {
	ast: Node;
	newlineMode: 'br' | 'n';
	newlineRequired: boolean;
	options: Options;
	isMathUsed: boolean;

	constructor(ast: Node, options: Options) {
		this.ast = ast;
		this.newlineMode = 'br';
		this.newlineRequired = false;
		this.options = options;
		this.isMathUsed = false;
	}

	getTopScripts = () => {
		if (this.isMathUsed) {
			const cdnUrl = 'https://unpkg.com/';
			const temmlPkg = 'temml@0.10';
			return trimAndJoin([
				'',
				`<LINK rel="stylesheet" href="${cdnUrl}${temmlPkg}/dist/Temml-Local.css">`,
			]);
		}
		return '';
	};

	preview = (body: string) => {
		if (this.options.debug) console.log('Renderer preview\n');
		const result = trimAndJoin([
			'<!DOCTYPE html>',
			'<html>',
			'<head>',
			'<title>Markfive</title>',
			`<meta charset="UTF-8">${this.getTopScripts()}`,
			'<meta name="viewport" content="width=device-width, initial-scale=1.0">',
			'</head>',
			'<body>',
			body,
			'</body>',
			'</html>',
			'',
		]);
		return result;
	};

	render = () => {
		if (this.options.debug) console.log('Renderer render\n');
		return this.renderNode(this.ast);
	};

	renderNode = (node: Node) => {
		let elementType;

		if (node.type === 'DOCUMENT') {
			let string = '';
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			return string;
		}
		if (node.type === 'HEADING') elementType = `h${node.subtype}`;
		if (node.type === 'TABLE_CELL') elementType = tableCellElementMappings[node.subtype!]!;
		if (node.type === 'TEXT') {
			return node.content!;
		}
		if (node.type === 'LINE') {
			let string = '';
			if (this.newlineRequired) string = this.newlineMode === 'br' ? '<br>\n' : '\n';
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			this.newlineRequired = true;
			return string;
		}
		if (node.type === 'BLOCK_CODE') {
			this.newlineMode = 'n';
			let string = `<pre${stringifyAttributes(node.attributes)}><code>`;
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			return `${string}</code></pre>\n`;
		}
		if (node.type === 'BLOCK_MATH') {
			this.isMathUsed = true;
			return node.content + '\n';
		}
		if (node.type === 'INLINE_MATH') {
			this.isMathUsed = true;
			return node.children[0]?.content ?? '';
		}
		elementType ||= elementMappings[node.type] ?? node.type.toLowerCase();

		if (this.options.debug) console.log('renderNode', node.type, elementType, node.attributes ?? '');

		this.newlineMode = 'br';
		this.newlineRequired = false;
		if (node.children.length > 0) {
			let string = `<${elementType}${stringifyAttributes(node.attributes)}>`;
			if (mainBlockElements.includes(elementType)) string += '\n';
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			string += `</${elementType}>`;
			if (node instanceof BlockNode) string += '\n';
			return string;
		} else {
			return `<${elementType}${stringifyAttributes(node.attributes)}/>\n`;
		}
	};
}

export default Renderer;
