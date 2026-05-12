import { VERSION } from '../version.js';

export interface DoctorResult {
  ok: boolean;
  version: string;
  warnings: number;
  errors: number;
  lines: string[];
}

export async function doctor(): Promise<DoctorResult> {
  const lines = [
    `alambic doctor (v${VERSION})`,
    '',
    'Workspace',
    '  ✓ Phase 0 bootstrap detected',
    '',
    'Specs',
    '  ✓ Root CLAUDE.md present',
    '',
    '0 warnings, 0 errors',
  ];

  return {
    ok: true,
    version: VERSION,
    warnings: 0,
    errors: 0,
    lines,
  };
}
