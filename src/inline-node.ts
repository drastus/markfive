import {type InlineToken, type InlineNodeType, type Node} from './types';

class InlineNode {
	type: InlineNodeType;
	attributes?: Record<string, string | string[]>;
	content?: string;
	children: Node[];
	tokens?: InlineToken[];

	constructor(
		type: InlineNodeType,
		spec?: {
			attributes?: Record<string, string | string[]>,
			content?: string,
			children?: Node[],
			tokens?: InlineToken[],
		},
	) {
		this.type = type;
		this.attributes = spec?.attributes;
		this.content = spec?.content;
		this.children = spec?.children ?? [];
		this.tokens = spec?.tokens;
	}
}

export default InlineNode;
