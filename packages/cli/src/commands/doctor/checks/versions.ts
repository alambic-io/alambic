import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Check } from '../types.js';

const exec = promisify(execFile);

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR_FOR_MAJOR_22 = 12;

export const versionsCheck: Check = async () => {
  const results = [];

  // Node — read from process.versions, no subprocess needed.
  const nodeVer = process.versions['node'] ?? '0.0.0';
  const parts = nodeVer.split('.').map((s) => parseInt(s, 10));
  const nodeMajor = parts[0] ?? 0;
  const nodeMinor = parts[1] ?? 0;
  if (
    nodeMajor < MIN_NODE_MAJOR ||
    (nodeMajor === MIN_NODE_MAJOR && nodeMinor < MIN_NODE_MINOR_FOR_MAJOR_22)
  ) {
    results.push({
      group: 'Versions',
      name: 'Node',
      severity: 'fail' as const,
      message: `Node ${nodeVer} is below the minimum (>=22.12.0).`,
      hint: 'Upgrade Node via fnm/nvm/Volta to the latest LTS.',
    });
  } else {
    results.push({
      group: 'Versions',
      name: 'Node',
      severity: 'pass' as const,
      message: `Node ${nodeVer}`,
    });
  }

  // pnpm
  try {
    const { stdout } = await exec('pnpm', ['--version']);
    const pnpmVer = stdout.trim();
    const major = parseInt(pnpmVer.split('.')[0] ?? '0', 10);
    if (major < 9) {
      results.push({
        group: 'Versions',
        name: 'pnpm',
        severity: 'warn' as const,
        message: `pnpm ${pnpmVer} (>= 9 recommended).`,
      });
    } else {
      results.push({
        group: 'Versions',
        name: 'pnpm',
        severity: 'pass' as const,
        message: `pnpm ${pnpmVer}`,
      });
    }
  } catch {
    results.push({
      group: 'Versions',
      name: 'pnpm',
      severity: 'warn' as const,
      message: 'pnpm not found on $PATH.',
      hint: 'Install pnpm: https://pnpm.io/installation',
    });
  }

  // Shopify CLI
  try {
    const { stdout } = await exec('shopify', ['version']);
    const match = /(\d+\.\d+\.\d+)/.exec(stdout);
    const shopifyVer = match?.[1] ?? stdout.trim().split(/\s+/)[0] ?? 'unknown';
    results.push({
      group: 'Versions',
      name: 'Shopify CLI',
      severity: 'pass' as const,
      message: `Shopify CLI ${shopifyVer}`,
    });
  } catch {
    results.push({
      group: 'Versions',
      name: 'Shopify CLI',
      severity: 'fail' as const,
      message: 'Shopify CLI not found on $PATH.',
      hint: 'Install: npm install -g @shopify/cli@latest',
    });
  }

  return results;
};
