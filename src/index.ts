import InlineParser from './inline-parser';
import LineLexer from './line-lexer';
import LineParser from './line-parser';
import Renderer from './renderer';

class Markfive {
	source: string;

	constructor(source: string) {
		this.source = source;
	}

	run = () => {
		const lineLexer = new LineLexer(this.source);
		const lineTokens = lineLexer.tokenize();

		const lineParser = new LineParser(lineTokens);
		let ast = lineParser.parse();

		const inlineParser = new InlineParser(ast);
		ast = inlineParser.parse();

		const renderer = new Renderer(ast);
		renderer.render();
	};
}

export default Markfive;
