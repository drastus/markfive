import LineLexer from './line-lexer';
import Parser from './parser';
import Renderer from './renderer';

class Markfive {
	source: string;

	constructor(source: string) {
		this.source = source;
	}

	run = () => {
		const lineLexer = new LineLexer(this.source);
		const lineTokens = lineLexer.tokenize();

		// const inlineLexer = new InlineLexer(lineTokens);
		// const tokens = inlineLexer.tokenize();

		const parser = new Parser(lineTokens);
		const ast = parser.parse();

		const renderer = new Renderer(ast);
		return renderer.render();
	}
}

export default Markfive;
