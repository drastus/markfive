#!/usr/bin/env node

import fs from 'node:fs';
import Markfive from '.';
import defaultOptions from './default-options';
import {type Options} from './types';

const args = process.argv;

let input = '';

const options = {...defaultOptions};

args.forEach((arg) => {
	if (arg.startsWith('--') && Object.keys(options).includes(arg.slice(2))) {
		options[arg.slice(2) as keyof Options] = true;
	}
});
if (options['debug-tokens']) {
	options.debug = true;
}

try {
	input += fs.readFileSync(args[args.length - 1]!, 'utf8');
} catch (err) {
	console.error(err);
	process.exit(1);
}

const markfive = new Markfive(input, options);
markfive.run();
