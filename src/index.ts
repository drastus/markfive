import InlineLexer from './inline-lexer';
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

		const parser = new Parser(lineTokens);
		let ast = parser.parse();

		const inlineLexer = new InlineLexer(ast);
		ast = inlineLexer.tokenize();

		const renderer = new Renderer(ast);
		renderer.render();
	};
}

export default Markfive;
