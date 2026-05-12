import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { glob } from 'tinyglobby';

export interface CopyThemeOptions {
  themeRoot: string;
  output: string;
  /** Glob patterns (relative to themeRoot) that should NOT be copied. */
  exclude?: ReadonlyArray<string>;
}

/**
 * Copy the static Liquid/JSON parts of the consumer theme into `output/`.
 * Skips: dotfiles, the Vite-managed `assets/` directory, JS/TS/CSS source
 * files (those become bundled assets), and anything matching `exclude`.
 *
 * Idempotent — safe to call multiple times.
 */
export async function copyTheme(options: CopyThemeOptions): Promise<string[]> {
  const ignore = [
    '**/node_modules/**',
    '**/.git/**',
    'assets/**',
    '.alambic/**',
    'snippets/alambic-asset.liquid',
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
    '**/*.css',
    '**/*.scss',
    '**/*.sass',
    '**/*.less',
    ...(options.exclude ?? []),
  ];

  // Only descend into the conventional theme directories.
  const roots = await discoverThemeDirs(options.themeRoot);
  const patterns = roots.map((d) => `${d}/**/*`);

  const files = await glob(patterns, {
    cwd: options.themeRoot,
    ignore,
    onlyFiles: true,
    dot: false,
  });

  await mkdir(options.output, { recursive: true });

  const copied: string[] = [];
  for (const rel of files) {
    const src = join(options.themeRoot, rel);
    const dest = join(options.output, rel);
    await mkdir(dirname(dest), { recursive: true });
    await cp(src, dest);
    copied.push(rel);
  }
  return copied.sort();
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '.' : p.slice(0, i);
}

const THEME_DIR_NAMES = [
  'sections',
  'snippets',
  'templates',
  'config',
  'locales',
  'layout',
  'blocks',
] as const;

async function discoverThemeDirs(themeRoot: string): Promise<string[]> {
  const present: string[] = [];
  const dirents = await safeReaddir(themeRoot);
  for (const name of dirents) {
    if (THEME_DIR_NAMES.includes(name as (typeof THEME_DIR_NAMES)[number])) {
      const full = join(themeRoot, name);
      const s = await stat(full).catch(() => null);
      if (s?.isDirectory()) {
        present.push(relative(themeRoot, full).replace(/\\/g, '/'));
      }
    }
  }
  return present;
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
