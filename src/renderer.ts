import type BlockNode from './block-node';

class Renderer {
	ast: BlockNode;

	constructor(ast: BlockNode) {
		this.ast = ast;
	}

	render = () => {
		console.log('render\n');
		process.stdout.write(JSON.stringify(this.ast, null, 4));
		process.stdout.write('\n');
	};
}

export default Renderer;
