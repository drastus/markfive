import type {Node} from './types';

class Renderer {
	ast: Node;

	constructor(ast: Node) {
		this.ast = ast;
	}

	render = () => {
		console.log('render\n');
		process.stdout.write(JSON.stringify(this.ast, null, 4));
		process.stdout.write('\n');
	};
}

export default Renderer;
