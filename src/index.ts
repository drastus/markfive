import InlineParser from './inline-parser';
import LineLexer from './line-lexer';
import LineParser from './line-parser';
import Renderer from './renderer';
import {type Options} from './types';

class Markfive {
	source: string;
	options: Options;

	constructor(source: string, options: Options) {
		this.source = source;
		this.options = options;
	}

	run = () => {
		const lineLexer = new LineLexer(this.source, this.options);
		const lineTokens = lineLexer.tokenize();

		if (!this.options.tokens) {
			const lineParser = new LineParser(lineTokens, this.options);
			let ast = lineParser.parse();

			if (!this.options['line-ast']) {
				const inlineParser = new InlineParser(ast, this.options);
				ast = inlineParser.parse();

				if (!this.options.ast) {
					const renderer = new Renderer(ast, this.options);
					renderer.render();
				}
			}
		}
	};
}

export default Markfive;
