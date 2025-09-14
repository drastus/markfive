import type BlockNode from './block-node';
import type InlineNode from './inline-node';

export type Options = {
	tokens: boolean,
	'line-ast': boolean,
	ast: boolean,
	debug: boolean,
	'debug-tokens': boolean,
	'no-typography': boolean,
	preview: boolean,
};

export type LineTokenType =
	| 'EMPTY_LINE'
	| 'LINE_WITH_ATTRIBUTES'
	| 'LINE_WITH_BLOCK_CODE_MARK'
	| 'LINE_WITH_BLOCK_QUOTE_MARK'
	| 'LINE_WITH_BLOCK_KBD_MARK'
	| 'LINE_WITH_BLOCK_SAMP_MARK'
	| 'LINE_WITH_DIV_MARK'
	| 'LINE_WITH_HEADING_MARK'
	| 'LINE_WITH_LIST_ITEM_MARK'
	| 'LINE_WITH_DESCRIPTION_LIST_ITEM_MARK'
	| 'LINE_WITH_FINAL_COLON'
	| 'LINE_WITH_SEPARATOR_MARK'
	| 'LINE_WITH_TABLE_ROW_MARK'
	| 'LINE_WITH_TABLE_CELL_MARK'
	| 'LINE_WITH_MATH_MARK'
	| 'LINE_WITH_BLOCK_OTHER_MARK'
	| 'LINE_WITH_COMMENT_MARK'
	| 'TEXT_LINE';

export type LineToken = {
	type: LineTokenType,
	line?: string,
	indent?: number,
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
	| 'DESCRIPTION_LIST'
	| 'DESCRIPTION_LIST_ITEM'
	| 'SEPARATOR'
	| 'BLOCK_CODE'
	| 'BLOCK_QUOTE'
	| 'BLOCK_KBD'
	| 'BLOCK_SAMP'
	| 'KEY'
	| 'BUTTON'
	| 'DIV'
	| 'TABLE'
	| 'TABLE_ROW'
	| 'EXPLICIT_TABLE_ROW'
	| 'TABLE_CELLS'
	| 'BLOCK_MATH'
	| 'BLOCK_OTHER'
	| 'COMMENT';

export type InlineTokenType =
	| 'TEXT'
	| 'BRACKET'
	| 'EM'
	| 'STRONG'
	| 'MARK'
	| 'DFN'
	| 'VAR'
	| 'SUP'
	| 'SUB'
	| 'CODE'
	| 'KBD'
	| 'KEY'
	| 'KEY_JOINER'
	| 'BUTTON'
	| 'BUTTON_SEPARATOR'
	| 'SAMP'
	| 'CITE'
	| 'B'
	| 'I'
	| 'U'
	| 'S'
	| 'TD'
	| 'TH'
	| 'MATH'
	| 'IMAGE'
	| 'SPAN'
	| 'BR'
	| 'WBR'
	| 'VARIABLE'
	| 'INLINE_OTHER';

export type InlineNodeType =
	| 'TEXT'
	| 'EM'
	| 'STRONG'
	| 'MARK'
	| 'DFN'
	| 'VAR'
	| 'SUP'
	| 'SUB'
	| 'CODE'
	| 'KBD'
	| 'SAMP'
	| 'KEY'
	| 'KEY_JOINER'
	| 'BUTTON'
	| 'BUTTON_SEPARATOR'
	| 'CITE'
	| 'B'
	| 'I'
	| 'U'
	| 'S'
	| 'A'
	| 'INLINE_MATH'
	| 'NOTE'
	| 'IMG'
	| 'OBJECT'
	| 'BR'
	| 'WBR'
	| 'INLINE_OTHER';

export type InlineToken = {
	type: InlineTokenType,
	positions?: Set<'start' | 'end'>,
	text?: string,
	attributes?: string,
	defaultAttribute?: string,
};
