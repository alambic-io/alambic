import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { substitute } from './substitute.js';

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.liquid',
  '.html',
  '.css',
  '.scss',
  '.yml',
  '.yaml',
  '.gitignore',
  '.env',
]);

/**
 * Copy `src` into `dest` recursively. Text files have `{{VAR}}` tokens
 * substituted against `vars`. Binary files are copied byte-for-byte.
 * Returns the list of relative paths that were written.
 */
export async function copyTemplate(
  src: string,
  dest: string,
  vars: Readonly<Record<string, string>>,
): Promise<string[]> {
  await mkdir(dest, { recursive: true });
  const written: string[] = [];
  await walk(src, src, dest, vars, written);
  return written.sort();
}

async function walk(
  root: string,
  current: string,
  destBase: string,
  vars: Readonly<Record<string, string>>,
  written: string[],
): Promise<void> {
  const entries = await readdir(current);
  for (const name of entries) {
    const srcPath = join(current, name);
    const rel = relative(root, srcPath);
    const destPath = join(destBase, rel);
    const s = await stat(srcPath);
    if (s.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await walk(root, srcPath, destBase, vars, written);
    } else if (s.isFile()) {
      await mkdir(dirname(destPath), { recursive: true });
      if (isTextFile(name)) {
        const content = await readFile(srcPath, 'utf8');
        await writeFile(destPath, substitute(content, vars), 'utf8');
      } else {
        await copyFile(srcPath, destPath);
      }
      written.push(rel.replace(/\\/g, '/'));
    }
  }
}

function isTextFile(name: string): boolean {
  if (name.startsWith('.')) return TEXT_EXTENSIONS.has(name);
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot));
}
