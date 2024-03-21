class Parser {
	tokens: LineToken[];

	constructor(tokens: LineToken[]) {
		this.tokens = tokens;
	}

	parse = () => {
		console.log('parse');
		return this.tokens;
	}
}

export default Parser;
