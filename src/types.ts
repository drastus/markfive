type LineTokenType =
	'EMPTY_LINE' |
	'LINE_WITH_ATTRIBUTES' |
	'LINE_WITH_BLOCK_CODE_MARK' |
	'LINE_WITH_BLOCK_QUOTE_MARK' |
	'LINE_WITH_HEADING_MARK' |
	'LINE_WITH_LIST_ITEM_MARK' |
	'LINE_WITH_SEPARATOR_MARK' |
	'TEXT_LINE';

type LineToken = {
	type: LineTokenType,
	line?: string,
	indent?: string,
	marker?: string,
	text?: string,
	level?: number,
	attributes?: string,
};

type BlockNodeType =
	'DOCUMENT' |
	'HEADING' |
	'PARAGRAPH' |
	'LINE' |
	'ORDERED_LIST' |
	'UNORDERED_LIST' |
	'LIST_ITEM' |
	'SEPARATOR' |
	'BLOCK_CODE' |
	'BLOCK_QUOTE';
