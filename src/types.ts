import type BlockNode from './block-node';
import type InlineNode from './inline-node';

export type Options = {
	tokens: boolean,
	'line-ast': boolean,
	ast: boolean,
	debug: boolean,
};

export type LineTokenType =
	| 'EMPTY_LINE'
	| 'LINE_WITH_ATTRIBUTES'
	| 'LINE_WITH_BLOCK_CODE_MARK'
	| 'LINE_WITH_BLOCK_QUOTE_MARK'
	| 'LINE_WITH_HEADING_MARK'
	| 'LINE_WITH_LIST_ITEM_MARK'
	| 'LINE_WITH_SEPARATOR_MARK'
	| 'LINE_WITH_TABLE_ROW_MARK'
	| 'LINE_WITH_TABLE_ROW_SEPARATOR_MARK'
	| 'LINE_WITH_TABLE_CELL_MARK'
	| 'LINE_WITH_MATH_MARK'
	| 'TEXT_LINE';

export type LineToken = {
	type: LineTokenType,
	line?: string,
	indent?: string,
	marker?: string,
	text?: string,
	level?: number,
	attributes?: string,
};

export type Node = BlockNode | InlineNode;

export type BlockNodeType =
	| 'DOCUMENT'
	| 'HEADING'
	| 'PARAGRAPH'
	| 'LINE'
	| 'ORDERED_LIST'
	| 'UNORDERED_LIST'
	| 'LIST_ITEM'
	| 'SEPARATOR'
	| 'BLOCK_CODE'
	| 'BLOCK_QUOTE'
	| 'TABLE'
	| 'TABLE_ROW'
	| 'TABLE_CELL'
	| 'BLOCK_MATH';

export type InlineTokenType =
	| 'TEXT'
	| 'BRACKET_OPEN'
	| 'BRACKET_CLOSE'
	| 'EM'
	| 'STRONG'
	| 'MARK'
	| 'DFN'
	| 'VAR'
	| 'CODE'
	| 'CITE'
	| 'B'
	| 'I'
	| 'U'
	| 'S'
	| 'TD'
	| 'TH';

export type InlineNodeType =
	| 'TEXT'
	| 'EM'
	| 'STRONG'
	| 'MARK'
	| 'DFN'
	| 'VAR'
	| 'CODE'
	| 'CITE'
	| 'B'
	| 'I'
	| 'U'
	| 'S'
	| 'A';

export type InlineToken = {
	type: InlineTokenType,
	position?: Array<'start' | 'end'>,
	text?: string,
	attributes?: string,
	defaultAttribute?: string,
};
