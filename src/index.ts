import defaultOptions from './default-options';
import InlineParser from './inline-parser';
import LineLexer from './line-lexer';
import LineParser from './line-parser';
import Renderer from './renderer';
import Typography from './typography';
import {type Options} from './types';

class Markfive {
	source: string;
	options: Options;

	constructor(source: string, options: Partial<Options> = {}) {
		this.source = source;
		this.options = {...defaultOptions, ...options};
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

				if (!this.options['no-typography']) {
					const typography = new Typography(ast, this.options);
					ast = typography.parse();
				}

				if (!this.options.ast) {
					const renderer = new Renderer(ast, this.options);
					let result = renderer.render();

					if (this.options.preview) {
						result = renderer.preview(result);
					}
					process.stdout.write(result);
				}
			}
		}
	};
}

export default Markfive;
