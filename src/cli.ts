#!/usr/bin/env node

import fs from 'node:fs';
import Markfive from '.';
import defaultOptions from './default-options';
import {type Options} from './types';

type BoolOptionKey = {[K in keyof Options]: Options[K] extends boolean ? K : never}[keyof Options];
type NumericOptionKey = {[K in keyof Options]: Options[K] extends number ? K : never}[keyof Options];

const args = process.argv;

let input = '';

const options = {...defaultOptions, print: true};
const data: Record<string, string> = {};

const numericOptions: Array<keyof Options> = ['heading-shift'];

args.forEach((arg) => {
	if (arg.startsWith('--')) {
		if (arg.slice(2).includes('=')) {
			const [key, value] = arg.slice(2).split('=');
			if (key && numericOptions.includes(key as keyof Options)) {
				options[key as NumericOptionKey] = Number(value);
			} else {
				data[key ?? ''] = value ?? '';
			}
		} else if (Object.keys(options).includes(arg.slice(2))) {
			options[arg.slice(2) as BoolOptionKey] = true;
		}
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

const markfive = new Markfive(input, options, data);
markfive.run();
