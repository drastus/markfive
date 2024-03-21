class Renderer {
	ast: LineToken[]

	constructor(ast: LineToken[]) {
		this.ast = ast;
	}

	render = () => {
		console.log('render\n');
		process.stdout.write(this.ast.map((n) => JSON.stringify(n)).join('\n'));
		process.stdout.write('\n');
	}
}

export default Renderer;
