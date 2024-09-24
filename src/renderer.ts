import BlockNode from './block-node';
import {stringifyAttributes} from './helpers';
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

class Renderer {
	ast: Node;
	newlineMode: 'br' | 'n';
	newlineRequired: boolean;
	options: Options;

	constructor(ast: Node, options: Options) {
		this.ast = ast;
		this.newlineMode = 'br';
		this.newlineRequired = false;
		this.options = options;
	}

	render = () => {
		if (this.options.debug) console.log('Renderer render\n');
		const result = this.renderNode(this.ast);

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

		this.newlineMode = 'br';
		this.newlineRequired = false;
		if (node.children.length > 0) {
			let string = `<${elementType}${stringifyAttributes(node.attributes)}>`;
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
