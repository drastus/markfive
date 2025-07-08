import BlockNode from './block-node';
import {stringifyAttributes, trimAndJoin} from './helpers';
import type InlineNode from './inline-node';
import type {Node, Options} from './types';

const elementMappings: Record<string, string> = {
	PARAGRAPH: 'p',
	ORDERED_LIST: 'ol',
	UNORDERED_LIST: 'ul',
	LIST_ITEM: 'li',
	TABLE_ROW: 'tr',
	SEPARATOR: 'hr',
	BLOCK_QUOTE: 'blockquote',
};
const tableCellElementMappings: Record<string, string> = {
	'|': 'td',
	'!': 'th',
};
const mainBlockElements = ['body', 'table', 'tr', 'ol', 'ul'];

const notesListTypes = [
	'decimal',
	'lower-alpha',
	'upper-alpha',
];

const countToCue = (count: number, noteType: string) => {
	if ((noteType.length - 1) % 3 === 0) return count;
	const base = 26;
	let result = '';
	let num = count;
	while (num > 0) {
		num--;
		result = String.fromCharCode((noteType.length % 3 === 0 ? 65 : 97) + (num % base)) + result;
		num = Math.floor(num / base);
	}
	return result;
};

class Renderer {
	ast: Node;
	newlineMode: 'br' | 'n';
	newlineRequired: boolean;
	options: Options;
	isMathUsed: boolean;
	notes: Record<string, Node[]> = {};
	noteRefs: Record<string, Array<{id: string, refId: string}>> = {};

	constructor(ast: Node, options: Options) {
		this.ast = ast;
		this.newlineMode = 'br';
		this.newlineRequired = false;
		this.options = options;
		this.isMathUsed = false;
	}

	escapeHtml = (str: string) => str
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	getTopIncludes = () => {
		let topScripts = '<link rel="stylesheet" href="../lib/markfive.css">';
		if (this.isMathUsed) {
			const cdnUrl = 'https://unpkg.com/';
			const temmlPkg = 'temml@0.10';
			topScripts = trimAndJoin([
				topScripts,
				`<link rel="stylesheet" href="${cdnUrl}${temmlPkg}/dist/Temml-Local.css">`,
			]);
		}
		if (Object.keys(this.notes).length > 0) {
			topScripts = trimAndJoin([
				topScripts,
				'<script src="../lib/notes.js"></script>', // make it absolute
			]);
		}
		return topScripts;
	};

	preview = (body: string) => {
		if (this.options.debug) console.log('\nRenderer preview\n');
		const result = trimAndJoin([
			'<!DOCTYPE html>',
			'<html>',
			'<head>',
			'<title>Markfive</title>',
			`<meta charset="UTF-8">${this.getTopIncludes()}`,
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
		if (this.options.debug) console.log('\nRenderer render\n');
		return this.renderNode(this.ast);
	};

	renderNode = (node: Node) => {
		let elementType;

		if (node.type === 'DOCUMENT') {
			let string = '';
			node.children.forEach((child: Node) => {
				string += this.renderNode(child);
			});
			if (Object.keys(this.notes).length > 0) string += this.renderNotes();
			return string;
		}
		if (node.type === 'HEADING') elementType = `h${node.subtype}`;
		if (node.type === 'TABLE_CELL') elementType = tableCellElementMappings[node.subtype!]!;
		if (node.type === 'TEXT') {
			return this.escapeHtml(node.content!);
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
			return node.content ?? '';
		}
		if (node.type === 'NOTE') {
			const refCount = (this.noteRefs[node.subtype!]?.length ?? 0) + 1;
			const count = node.id
				? ((this.notes[node.subtype!]?.findIndex((note) => note.attributes?.id === node.id) ?? 0) + 1)
				: (this.notes[node.subtype!]?.length ?? 0) + 1;
			const noteRef = {
				refId: `mf-note-ref-${node.subtype!.length}-${refCount}`,
				id: node.id
					?? node.attributes?.id as string | undefined
					?? `mf-note-${node.subtype!.length}-${refCount}`,
			};
			if (!node.id) {
				this.notes[node.subtype!] ||= [];
				this.notes[node.subtype!]!.push({...node, id: noteRef.id});
			}
			this.noteRefs[node.subtype!] ||= [];
			this.noteRefs[node.subtype!]!.push(noteRef);
			const cue = `<sup>${countToCue(count, node.subtype!)}</sup>`;
			return `<a href="#${noteRef.id}" id="${noteRef.refId}" class="mf-note-ref">${cue}</a>`;
		}

		elementType ??= elementMappings[node.type] ?? node.type.toLowerCase();
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

	renderNotes = () => {
		let string = '';
		const noteTypes = Object.keys(this.notes);
		noteTypes.sort((a, b) => a.length - b.length);
		noteTypes.forEach((noteType) => {
			string += '<hr class="mf-notes-separator"/>\n';
			string += `<ol class="mf-notes" style="list-style-type: ${notesListTypes[(noteType.length - 1) % 3]}">\n`;
			const notes = this.notes[noteType]!;
			notes.forEach((note) => {
				const {id} = note as InlineNode;
				string += `<li class="mf-note" id="${id}">`;
				this.noteRefs[noteType]!.filter((ref) => ref.id === id).forEach((ref) => {
					string += `<a href="#${ref.refId}" class="mf-note-backref">↑</a>`;
				});
				string += ' ';
				note.children.forEach((child: Node) => {
					string += this.renderNode(child);
				});
				string += '</li>\n';
			});
			string += '</ol>\n';
		});
		return string;
	};
}

export default Renderer;
