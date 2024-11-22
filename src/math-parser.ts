import Temml from 'temml';

type SourceLocation = {
	lexer: object,
	start: number,
	end: number,
};

type AtomType =
	| 'atom'
	| 'ord'
	| 'textord'
	| 'mathord'
	| 'op'
	| 'bin'
	| 'rel'
	| 'supsub'
	| 'genfrac'
	| 'open'
	| 'close'
	| 'punct'
	| 'inner'
	| 'accent'
	| 'spacing'
	| 'rule'
	| 'leftright'
	| 'middle'
	| 'ordgroup'
	| 'text'
	| 'color'
	| 'size'
	| 'styling'
	| 'font'
	| 'delimsizing'
	| 'mathchoice'
	| 'sqrt'
	| 'overline'
	| 'underline'
	| 'kern'
	| 'vcenter'
	| 'vphantom'
	| 'hphantom'
	| 'smash'
	| 'lap'
	| 'llap'
	| 'rlap'
	| 'raise'
	| 'lower'
	| 'cr'
	| 'newline'
	| 'nobreak'
	| 'url'
	| 'href'
	| 'includegraphics'
	| 'verb';

type Atom = {
	type: AtomType,
	mode: 'math' | 'text',
	loc?: SourceLocation,
	text?: string,
	body?: Atom[] | Atom,
	family?: 'rel' | 'op' | 'bin' | 'ord' | 'open' | 'close' | 'punct' | 'inner' | 'accent',
	symbol?: boolean,
	name?: string,
	value?: string | number,
	delim?: string,
	size?: string,
	mclass?: string,
	limits?: boolean,
	alwaysHandleSupSub?: boolean,
	base?: Atom,
	sup?: Atom,
	sub?: Atom,
	numer?: Atom,
	denom?: Atom,
	index?: Atom,
	font?: string,
};

function findOpenParen(atoms: Atom[], closePos: number): number {
	let openPos = closePos;
	let counter = 1;
	while (counter > 0) {
		const c = atoms[--openPos];
		if (c?.text === '(') {
			counter--;
		} else if (c?.text === ')') {
			counter++;
		}
	}
	return openPos;
}

function findCloseParen(atoms: Atom[], openPos: number): number {
	let closePos = openPos;
	let counter = 1;
	while (counter > 0) {
		const c = atoms[++closePos];
		if (c?.text === ')') {
			counter--;
		} else if (c?.text === '(') {
			counter++;
		}
	}
	return closePos;
}

function unparseAtom(atom: Atom): string {
	if (atom.text !== undefined) {
		return atom.text;
	}
	if (atom.type === 'op' && atom.name !== undefined) {
		return atom.name;
	}
	let string = '';

	if (atom.type === 'ordgroup') string += '{';
	if (atom.type === 'font' && atom.font !== undefined) {
		string += `\\${atom.font}{`;
	}
	if (atom.type === 'sqrt') {
		string += '\\sqrt';
		if (atom.index) string += `[${unparseAtom(atom.index)}]`;
	}

	let body: Atom[] = [];
	if (atom.body) {
		body = Array.isArray(atom.body) ? atom.body : [atom.body];
	}

	const divisionIndex = body.findIndex((subatom) => subatom.type === 'textord' && subatom.text === '/');
	if (divisionIndex > 0) {
		let numeratorStartIndex = divisionIndex - 1;
		const numeratorEndIndex = numeratorStartIndex;
		let omitNumeratorBrackets = false;
		if (body[numeratorStartIndex]?.text === ')') {
			numeratorStartIndex = findOpenParen(body, numeratorStartIndex);
			omitNumeratorBrackets = true;
		} else {
			while (['textord', 'mathord'].includes(body[numeratorStartIndex - 1]?.type ?? '') && body[numeratorStartIndex - 1]?.text !== '/') {
				numeratorStartIndex--;
			}
		}
		const numerator: Atom = {
			type: 'ordgroup',
			mode: 'math',
			body: body.slice(numeratorStartIndex + (omitNumeratorBrackets ? 1 : 0), numeratorEndIndex + 1 - (omitNumeratorBrackets ? 1 : 0)),
		};

		const denominatorStartIndex = divisionIndex + 1;
		let denominatorEndIndex = denominatorStartIndex;
		let omitDenominatorBrackets = false;
		if (body[denominatorEndIndex]?.text === '(') {
			denominatorEndIndex = findCloseParen(body, denominatorEndIndex);
			omitDenominatorBrackets = true;
		} else {
			while (['textord', 'mathord'].includes(body[denominatorEndIndex + 1]?.type ?? '') && body[denominatorEndIndex + 1]?.text !== '/') {
				denominatorEndIndex++;
			}
		}
		const denominator: Atom = {
			type: 'ordgroup',
			mode: 'math',
			body: body.slice(denominatorStartIndex + (omitDenominatorBrackets ? 1 : 0), denominatorEndIndex + 1 - (omitDenominatorBrackets ? 1 : 0)),
		};

		if (numerator && denominator) {
			body = [
				...body.slice(0, numeratorStartIndex),
				{type: 'genfrac', mode: 'math', numer: numerator, denom: denominator},
				...body.slice(denominatorEndIndex + 1),
			];
		}
	}

	const ordgroupIndex = body.findIndex((subatom) => subatom.type === 'ordgroup');
	const setOperations = [
		'\\subset', '\\supset', '\\subseteq', '\\supseteq', '\\in', '\\ni', '\\not\\in', '\\not\\ni',
		'=', '⊂', '⊃', '⊆', '⊇', '∈', '∋', '∉', '∌',
		'\\cup', '\\cap', '\\setminus', '\\bigtriangleup', '\\vartriangle',
		'∪', '∩', '∖', '△',
	];
	if ((ordgroupIndex === 0 && body.length > 1)
		|| (ordgroupIndex > 0 && setOperations.includes(body[ordgroupIndex - 1]!.text ?? ''))
	) {
		const ordgroupBody = body[ordgroupIndex]!.body as Atom[];
		body = [
			...body.slice(0, ordgroupIndex),
			{type: 'atom', mode: 'math', family: 'open', text: '\\{'},
			...ordgroupBody,
			{type: 'atom', mode: 'math', family: 'close', text: '\\}'},
			...body.slice(ordgroupIndex + 1),
		];
	}

	string += body.map((subatom) => unparseAtom(subatom)).join(' ');

	if (atom.type === 'supsub') {
		string += `${unparseAtom(atom.base!)}`;
		if ('sup' in atom && atom.sup) string += `^${unparseAtom(atom.sup)}`;
		if ('sub' in atom && atom.sub) string += `_${unparseAtom(atom.sub)}`;
	}
	if (atom.type === 'genfrac') {
		string += `\\frac${unparseAtom(atom.numer!)}${unparseAtom(atom.denom!)}`;
	}
	if (atom.type === 'ordgroup') string += '}';
	if (atom.type === 'font' && atom.font !== undefined) {
		string += '}';
	}

	return string;
}

function applyUnicodeSymbols(expression: string): string {
	return expression.replace(/√/g, '\\sqrt').replace(/∛/g, '\\sqrt[3]');
}

export function markfiveMathToMathML(expression: string, debug = false): string {
	const parseTree = Temml.__parse(applyUnicodeSymbols(expression)) as Atom[];
	const result = unparseAtom({type: 'ordgroup', mode: 'math', body: parseTree});
	if (debug) {
		parseTree.forEach((atom) => {
			console.log(JSON.stringify(
				atom,
				(k: string, v: unknown) => k === 'lexer' ? undefined : v,
			));
		});
	}
	return Temml.renderToString(result, {displayMode: true});
}
