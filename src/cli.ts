#!/usr/bin/env node

import fs from 'node:fs';
import Markfive from '.';
import {type Options} from './types';

const args = process.argv;

let input = '';

const options: Options = {
	tokens: false,
	'line-ast': false,
	ast: false,
	debug: false,
	preview: false,
};

args.forEach((arg) => {
	if (arg.startsWith('--') && Object.keys(options).includes(arg.slice(2))) {
		options[arg.slice(2) as keyof Options] = true;
	}
});

try {
	input += fs.readFileSync(args[args.length - 1]!, 'utf8');
} catch (err) {
	console.error(err);
	process.exit(1);
}

const markfive = new Markfive(input, options);
markfive.run();
