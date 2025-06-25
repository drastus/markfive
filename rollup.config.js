import typescript from '@rollup/plugin-typescript';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';

export default [
	{
		input: 'src/index.ts',
		output: {
			dir: 'lib',
			format: 'cjs',
			sourcemap: true,
		},
		plugins: [typescript(), nodeResolve()],
	},
	{
		input: 'src/scripts/notes.ts',
		output: {
			dir: 'lib',
			format: 'cjs',
			sourcemap: true,
		},
		plugins: [typescript(), nodeResolve()],
	},
	{
		input: 'src/cli.ts',
		output: {
			dir: 'lib',
			format: 'cjs',
			sourcemap: true,
			entryFileNames: '[name].cjs',
		},
		external: ['node:fs'],
		plugins: [
			typescript(),
			nodeResolve(),
			copy({
				targets: [
					{src: 'src/styles/markfive.css', dest: 'lib'},
				],
			}),
		],
	},
];
