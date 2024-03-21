import {attributesRegexString, parseAttributes} from './helpers';

class LineLexer {
	lines: string[];
	tokens: LineToken[];
	current: number;

	constructor(source: string) {
		this.lines = source.split('\n').map((s) => s.trimEnd());
		this.tokens = [];
		this.current = 0;
	}

	lineIsEmpty = (add: number) => {
		if (this.current + add >= this.lines.length || this.current + add < 0) return true;
		return this.lines[this.current + add].length === 0;
	}

	tokenize = () => {
		console.log('LineLexer tokenize\n');

		while (this.current < this.lines.length) {
			this.tokenizeLine();
			this.current++;
		}

		return this.tokens;
	}

	tokenizeLine = () => {
		const line = this.lines[this.current];
		let match: RegExpMatchArray | null = null;

		if (line.length === 0) {
			return;
		}

		if (line.match(/^\* \* \*$/)) {
			if (this.lineIsEmpty(-1) && this.lineIsEmpty(+1)) {
				this.tokens.push({type: 'LINE_WITH_SEPARATOR_MARK', text: line});
				return;
			}
			this.tokens.push({type: 'TEXT_LINE', text: line});
			return;
		}

		for (const [index, char] of ['\\*', '=', '-', '\\.'].entries()) {
			if (line.match(`^${char}{3,}$`)) {
				if (this.lineIsEmpty(-2) && !this.lineIsEmpty(-1) && this.lineIsEmpty(+1)) {
					this.tokens.pop();
					this.tokens.push({type: 'LINE_WITH_HEADING_MARK', text: this.lines[this.current - 1], level: index + 1});
					return;
				}
				this.tokens.push({type: 'TEXT_LINE', text: line});
				return;
			}
		};

		const listItemRegexString = `^(-|\\d+\\.)${attributesRegexString} `;
		if (match = line.match(listItemRegexString)) {
			this.tokens.push({
				type: 'LINE_WITH_LIST_ITEM_MARK',
				text: line.substring(match[0].length),
				marker: match[1],
				attributes: parseAttributes(match[2]),
			});
			return;
		}
		this.tokens.push({type: 'TEXT_LINE', text: line, indent: line.match(/^[ \t]*/)?.[0].length ?? 0});
	}
}

export default LineLexer;
