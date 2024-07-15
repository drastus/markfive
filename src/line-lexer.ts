import {attributesRegexString} from './helpers';
import {LineToken} from './types';

class LineLexer {
	lines: string[];
	tokens: LineToken[];
	current: number;

	constructor(source: string) {
		this.lines = source.split('\n').map((s) => s.trimEnd());
		this.tokens = [];
		this.current = 0;
	}

	tokenize = () => {
		console.log('LineLexer tokenize\n');

		while (this.current < this.lines.length) {
			this.tokenizeLine();
			this.current++;
		}

		return this.tokens;
	};

	tokenizeLine = () => {
		const line = this.lines[this.current];
		let match: RegExpMatchArray | null = null;

		if (line.length === 0) {
			this.tokens.push({type: 'EMPTY_LINE'});
			return;
		}

		if (line.match(/^\* \* \*$/)) {
			this.tokens.push({type: 'LINE_WITH_SEPARATOR_MARK', line});
			return;
		}

		for (const [index, char] of ['\\*', '=', '-', '\\.'].entries()) {
			if (line.match(`^${char}{3,}$`)) {
				if ((this.lines[this.current - 1] ?? '').length > 0) {
					this.tokens.pop();
					this.tokens.push({
						type: 'LINE_WITH_HEADING_MARK',
						line: this.lines[this.current - 1],
						marker: line,
						level: index + 1,
						text: this.lines[this.current - 1].trimStart(),
					});
				} else {
					this.tokens.push({type: 'TEXT_LINE', text: line});
				}
				return;
			}
		}

		if (match = line.match(`^([ \t]*)${attributesRegexString}$`)) {
			this.tokens.push({
				type: 'LINE_WITH_ATTRIBUTES',
				line,
				indent: match[1],
				attributes: match[2],
			});
			return;
		}

		if (match = line.match(`^([ \t]*)(-|\\d+\\.)${attributesRegexString}(?: (.+))?`)) {
			this.tokens.push({
				type: 'LINE_WITH_LIST_ITEM_MARK',
				line,
				indent: match[1],
				marker: match[2],
				attributes: match[3],
				text: match[4],
			});
			return;
		}

		if (match = line.match(`^([ \t]*)""${attributesRegexString}(?: (.+))?$`)) {
			this.tokens.push({
				type: 'LINE_WITH_BLOCK_QUOTE_MARK',
				line,
				indent: match[1],
				attributes: match[2],
				text: match[3],
			});
			return;
		}

		if (match = line.match(`^([ \t]*)\`\`${attributesRegexString}(?: (.+))?$`)) {
			this.tokens.push({
				type: 'LINE_WITH_BLOCK_CODE_MARK',
				line,
				indent: match[1],
				attributes: match[2],
				text: match[3],
			});
			return;
		}

		this.tokens.push({
			type: 'TEXT_LINE',
			line,
			indent: line.match(/^[ \t]*/)?.[0],
			text: line.trimStart(),
		});
	};
}

export default LineLexer;
