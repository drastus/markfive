#!/usr/bin/env node

import fs from 'node:fs';
import Markfive from '.';

const args = process.argv;

let input = '';

try {
	input += fs.readFileSync(args[2], 'utf8');
} catch (err) {
	console.error(err);
	process.exit(1);
}

const markfive = new Markfive(input);
markfive.run();
