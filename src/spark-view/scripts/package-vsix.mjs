import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const packageJsonPath = resolve(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const outputDir = resolve(process.cwd(), 'publish');
const outputPath = resolve(outputDir, `${packageJson.name}-${packageJson.version}.vsix`);

mkdirSync(outputDir, { recursive: true });
for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.vsix')) {
    rmSync(resolve(outputDir, entry.name), { force: true });
  }
}

const result = spawnSync('npx', ['@vscode/vsce', 'package', '--out', outputPath], {
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
