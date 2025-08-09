import {type InlineToken, type InlineNodeType, type Node} from './types';

class InlineNode {
	type: InlineNodeType;
	subtype?: string;
	id?: string;
	attributes?: Record<string, string | string[] | number>;
	content?: string;
	children: Node[];
	tokens?: InlineToken[];

	constructor(
		type: InlineNodeType,
		spec?: {
			attributes?: Record<string, string | string[] | number>,
			content?: string,
			children?: Node[],
			tokens?: InlineToken[],
			subtype?: string,
			id?: string,
		},
	) {
		this.type = type;
		this.attributes = spec?.attributes;
		this.content = spec?.content;
		this.children = spec?.children ?? [];
		this.tokens = spec?.tokens;
		this.subtype = spec?.subtype;
		this.id = spec?.id;
	}
}

export default InlineNode;
