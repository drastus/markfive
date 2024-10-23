import BlockNode from './block-node';
import {stringifyAttributes, trimAndJoin} from './helpers';
import type {Node, Options} from './types';

const elementMappings: Record<string, string> = {
	DOCUMENT: 'BODY',
	PARAGRAPH: 'P',
	ORDERED_LIST: 'OL',
	UNORDERED_LIST: 'UL',
	LIST_ITEM: 'LI',
	TABLE_ROW: 'TR',
};
const tableCellElementMappings: Record<string, string> = {
	'|': 'TD',
	'!': 'TH',
};
const mainBlockElements = ['BODY', 'TABLE', 'TR', 'OL', 'UL'];

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
				`<SCRIPT src="${cdnUrl}${temmlPkg}/dist/temml.min.js"></SCRIPT>`,
				`<SCRIPT src="${cdnUrl}${temmlPkg}/contrib/auto-render/dist/auto-render.min.js"></SCRIPT>`,
			]);
		}
		return '';
	};

	getBottomScripts = () => {
		if (this.isMathUsed) {
			return trimAndJoin([
				'<SCRIPT>',
				'const mathElements = document.getElementsByClassName("math");',
				'for (let i = 0; i < mathElements.length; i++) renderMathInElement(mathElements[i], {delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}]});',
				'</SCRIPT>',
				'',
			]);
		}
		return '\n';
	};

	render = () => {
		if (this.options.debug) console.log('Renderer render\n');
		const body = this.renderNode(this.ast);
		const result = trimAndJoin([
			'<!DOCTYPE html>',
			'<HTML>',
			'<HEAD>',
			'<TITLE>Markfive</TITLE>',
			`<META charset="UTF-8">${this.getTopScripts()}`,
			'<META name="viewport" content="width=device-width, initial-scale=1.0">',
			'</HEAD>',
			body,
			'</HTML>',
			'',
		]);
		process.stdout.write(result);
	};

	renderNode = (node: Node) => {
		let elementType = elementMappings[node.type] ?? node.type;
		if (elementType === 'HEADING') elementType = `H${(node as BlockNode).subtype}`;
		if (elementType === 'TABLE_CELL') elementType = tableCellElementMappings[(node as BlockNode).subtype!];
		if (elementType === 'TEXT') {
			return node.content!;
		}
		if (elementType === 'LINE') {
			let string = '';
			if (this.newlineRequired) string = this.newlineMode === 'br' ? '<BR>\n' : '\n';
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			this.newlineRequired = true;
			return string;
		}
		if (elementType === 'BLOCK_CODE') {
			this.newlineMode = 'n';
			let string = `<PRE${stringifyAttributes(node.attributes)}><CODE>`;
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			return `${string}</CODE></PRE>\n`;
		}
		if (elementType === 'BLOCK_MATH') {
			this.isMathUsed = true;
			let string = '<DIV class="math">';
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			return `${string}</DIV>\n`;
		}

		this.newlineMode = 'br';
		this.newlineRequired = false;
		if (node.children.length > 0) {
			let string = `<${elementType}${stringifyAttributes(node.attributes)}>`;
			if (mainBlockElements.includes(elementType)) string += '\n';
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			if (elementType === 'BODY') string += this.getBottomScripts();
			string += `</${elementType}>`;
			if (node instanceof BlockNode) string += '\n';
			return string;
		} else {
			return `<${elementType}${stringifyAttributes(node.attributes)}/>\n`;
		}
	};
}

export default Renderer;
