import {execSync, spawnSync} from 'child_process';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = __dirname;
const files = readdirSync(testDir);
const mfFiles = files.filter((f) => f.endsWith('.mf'));

// 1. Re-generate .part.html files from .mf files
for (const mfFile of mfFiles) {
	const base = mfFile.replace(/\.mf$/, '');
	const mfPath = path.join(testDir, mfFile);
	const outPath = path.join(testDir, `${base}.part.html`);
	// Optional CLI arguments (e.g. variables) are read from a .args file next to the .mf file
	const argsPath = path.join(testDir, `${base}.args`);
	const args = existsSync(argsPath) ? readFileSync(argsPath, 'utf8').split(/\s+/).filter(Boolean) : [];
	// Use spawnSync so errors are visible
	const res = spawnSync('markfive', [...args, mfPath], {encoding: 'utf8'});
	if (res.error) {
		console.error(`Error running markfive on ${mfFile}:`, res.error);
		process.exit(1);
	}
	writeFileSync(outPath, res.stdout);
}

// 2. Check for changes in .part.html files
const status = execSync('git status --porcelain', {encoding: 'utf8'});
const changed = status.split('\n').filter((line) => line.match(/^[ MARC?]{2} test\/.+\.part\.html$/));

if (changed.length > 0) {
	// 3. Show diffs for changed .part.html files
	for (const line of changed) {
		const fname = line.trim().slice(2);
		try {
			const diff = execSync(`git diff --color=always -- ${fname}`, {encoding: 'utf8'});
			if (diff) {
				console.log(`\nChanges in ${fname}:\n`);
				console.log(diff);
			}
		} catch (e) {
			console.error(`Could not diff ${fname}:`, e);
		}
	}
	process.exit(1);
} else {
	process.stdout.write('No changes.\n');
}
