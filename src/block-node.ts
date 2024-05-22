class BlockNode {
	type: BlockNodeType;
	subtype?: string;
	attributes?: Record<string, string | string[]>;
	content?: string;
	children: BlockNode[];
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
			attributes?: Record<string, string | string[]>,
			subtype?: string,
			content?: string,
			children?: BlockNode[],
		},
	) {
		this.type = type;
		this.subtype = spec?.subtype;
		this.attributes = spec?.attributes;
		this.content = spec?.content;
		this.children = spec?.children ?? [];
		// this.defaultChildType = BlockNode.defaultChildTypes[type]
	}
}

export default BlockNode;
