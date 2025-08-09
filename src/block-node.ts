import {type BlockNodeType, type InlineToken, type Node} from './types';

class BlockNode {
	type: BlockNodeType;
	subtype?: string;
	attributes?: Record<string, string | string[] | number>;
	content?: string;
	subcontent?: string;
	children: Node[];
	tokens?: InlineToken[];
	// defaultChildType?: BlockNodeType;

	// static defaultChildTypes = {
	// 	'DOCUMENT': 'PARAGRAPH',
	// 	'PARAGRAPH': 'LINE',
	// 	'ORDERED_LIST': 'LIST_ITEM',
	// 	'UNORDERED_LIST': 'LIST_ITEM',
	// 	'BLOCK_CODE': 'LINE',
	// 	'BLOCK_QUOTE': 'LINE',
	// };

	constructor(
		type: BlockNodeType,
		spec?: {
			attributes?: Record<string, string | string[] | number>,
			subtype?: string,
			content?: string,
			subcontent?: string,
			children?: Node[],
		},
	) {
		this.type = type;
		this.subtype = spec?.subtype;
		this.attributes = spec?.attributes;
		this.content = spec?.content;
		this.subcontent = spec?.subcontent;
		this.children = spec?.children ?? [];
		// this.defaultChildType = BlockNode.defaultChildTypes[type]
	}
}

export default BlockNode;
