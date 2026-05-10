import copy from '@guanghechen/rollup-plugin-copy';
import typescript from '@rollup/plugin-typescript';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import {dts} from 'rollup-plugin-dts';

export default [
	{
		input: 'src/index.ts',
		output: {
			dir: 'lib',
			format: 'es',
			sourcemap: true,
		},
		plugins: [typescript(), nodeResolve()],
	},
	{
		input: 'src/index.ts',
		output: {
			file: 'lib/index.d.ts',
			format: 'es',
		},
		plugins: [
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			dts(),
		],
	},
	{
		input: 'src/scripts/notes.ts',
		output: {
			dir: 'lib',
			format: 'es',
			sourcemap: true,
		},
		plugins: [typescript({
			declarationDir: 'lib',
			declaration: true,
		}), nodeResolve()],
	},
	{
		input: 'src/cli.ts',
		output: {
			dir: 'lib',
			format: 'es',
			sourcemap: true,
			entryFileNames: '[name].js',
		},
		external: ['node:fs'],
		plugins: [
			typescript({
				declarationDir: 'lib',
				declaration: true,
			}),
			nodeResolve(),
			copy({
				targets: [
					{src: 'src/styles/markfive.css', dest: 'lib'},
				],
			}),
		],
	},
];
