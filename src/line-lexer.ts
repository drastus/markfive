import {attributesRegexString, calculateIndent} from './helpers';
import {type Options, type LineToken} from './types';

const escape = '(\\\\)?';

class LineLexer {
	lines: string[];
	tokens: LineToken[];
	current: number;
	options: Options;

	constructor(source: string, options: Options) {
		this.lines = source.split('\n').map((s) => s.trimEnd());
		this.tokens = [];
		this.current = 0;
		this.options = options;
	}

	tokenize = () => {
		if (this.options.debug) console.log('LineLexer tokenize\n');

		while (this.current < this.lines.length) {
			this.tokenizeLine();
			this.current++;
		}

		if (this.options.tokens || this.options.debug) console.log(this.tokens.map((t) => JSON.stringify(t)));
		return this.tokens;
	};

	tokenizeLine = () => {
		const line = this.lines[this.current]!;
		let match: RegExpMatchArray | null = null;

		if (line.length === 0) {
			this.tokens.push({type: 'EMPTY_LINE'});
			return;
		}

		if (match = line.match(`^[\t ]*${escape}\\* \\* \\*$`)) {
			if (!match[1]) {
				this.tokens.push({type: 'LINE_WITH_SEPARATOR_MARK', line});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[1] ? 1 : 0)});
			}
			return;
		}

		for (const [index, char] of ['\\*', '=', '-', '\\.'].entries()) {
			if (match = line.match(`^${escape}${char}{3,}$`)) {
				if ((this.lines[this.current - 1] ?? '').length > 0 && !match[1]) {
					this.tokens.pop();
					this.tokens.push({
						type: 'LINE_WITH_HEADING_MARK',
						line: this.lines[this.current - 1],
						marker: line,
						level: index + 1,
						text: this.lines[this.current - 1]!.trimStart(),
					});
				} else {
					this.tokens.push({type: 'TEXT_LINE', line: line.slice(match[1] ? 1 : 0)});
				}
				return;
			}
		}

		if (match = line.match(`^([ \t]*)${escape}${attributesRegexString}$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_ATTRIBUTES',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}(-|\\d+\\.)${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_LIST_ITEM_MARK',
					line,
					indent: calculateIndent(match[1]),
					marker: match[3],
					attributes: match[4],
					text: match[5],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}(:|=)${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_DESCRIPTION_LIST_ITEM_MARK',
					line,
					indent: calculateIndent(match[1]),
					marker: match[3],
					attributes: match[4],
					text: match[5],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}""${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_BLOCK_QUOTE_MARK',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
					text: match[4],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}\`\`${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_BLOCK_CODE_MARK',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
					text: match[4],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}>${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_BLOCK_KBD_MARK',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
					text: match[4],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}<${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_BLOCK_SAMP_MARK',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
					text: match[4],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}\\?\\?${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_DIV_MARK',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
					text: match[4],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}\\|${attributesRegexString}(\\||!)(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_TABLE_ROW_MARK',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
					text: match[4] + ' ' + match[5],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}\\|-${attributesRegexString}`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_TABLE_ROW_SEPARATOR_MARK',
					line,
					indent: calculateIndent(match[1]),
					attributes: match[3],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}(\\||!)${attributesRegexString}(?: (.+))?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_TABLE_CELL_MARK',
					line,
					indent: calculateIndent(match[1]),
					marker: match[3],
					attributes: match[4],
					text: match[5],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}\\$\\$(.+?)(\\$\\$)?$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_MATH_MARK',
					line,
					indent: calculateIndent(match[1]),
					text: match[3],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		if (match = line.match(/^([ \t]*)(.+:)$/)) {
			this.tokens.push({
				type: 'LINE_WITH_FINAL_COLON',
				line,
				indent: calculateIndent(match[1]),
				text: match[2],
			});
			return;
		}

		if (match = line.match(`^([ \t]*)${escape}@(header|main|footer|aside|address|pre|del|ins)${attributesRegexString}$`)) {
			if (!match[2]) {
				this.tokens.push({
					type: 'LINE_WITH_BLOCK_OTHER_MARK',
					line,
					indent: calculateIndent(match[1]),
					marker: match[3],
					attributes: match[4],
				});
			} else {
				this.tokens.push({type: 'TEXT_LINE', line: line.trimStart().slice(match[2] ? 1 : 0)});
			}
			return;
		}

		this.tokens.push({
			type: 'TEXT_LINE',
			line,
			indent: calculateIndent(line.match(/^[ \t]*/)?.[0]),
			text: line.trimStart(),
		});
	};
}

export default LineLexer;
