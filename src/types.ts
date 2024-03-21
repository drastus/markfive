type LineTokenType =
	'TEXT_LINE' |
	'LINE_WITH_HEADING_MARK' |
	'LINE_WITH_LIST_ITEM_MARK' |
	'LINE_WITH_SEPARATOR_MARK';

 type LineToken = {
	type: LineTokenType,
	text?: string,
	indent?: number,
	level?: number,
	marker?: string,
	attributes?: Record<string, string | string[]>,
 }
