import { describe, expect, it } from 'vitest';
import { block } from '../builders/block.js';
import { section } from '../builders/section.js';
import { range, select, text, video_url } from '../builders/settings.js';
import { hasErrors, validateSection } from './validate.js';

describe('validateSection', () => {
  it('passes a clean section', () => {
    const issues = validateSection(
      section({
        name: 'Hero',
        settings: [text({ id: 'heading', label: 'Heading' })],
      }),
    );
    expect(hasErrors(issues)).toBe(false);
  });

  it('flags duplicate setting ids', () => {
    const issues = validateSection(
      section({
        name: 'Hero',
        settings: [
          text({ id: 'heading', label: 'Heading' }),
          text({ id: 'heading', label: 'Heading 2' }),
        ],
      }),
    );
    expect(issues.map((i) => i.code)).toContain('ALAMBIC_SCHEMA_DUPLICATE_ID');
  });

  it('flags a range whose default is outside min/max', () => {
    const issues = validateSection(
      section({
        name: 'Hero',
        settings: [range({ id: 'p', label: 'Padding', min: 0, max: 10, default: 99 })],
      }),
    );
    expect(issues.map((i) => i.code)).toContain('ALAMBIC_SCHEMA_RANGE_DEFAULT_OUT_OF_BOUNDS');
  });

  it('flags a range with max <= min', () => {
    const issues = validateSection(
      section({
        name: 'Hero',
        settings: [range({ id: 'p', label: 'Padding', min: 5, max: 5, default: 5 })],
      }),
    );
    expect(issues.map((i) => i.code)).toContain('ALAMBIC_SCHEMA_RANGE_INVALID');
  });

  it('flags empty select/radio options', () => {
    const issues = validateSection(
      section({
        name: 'Hero',
        settings: [select({ id: 's', label: 'Select', options: [] })],
      }),
    );
    expect(issues.map((i) => i.code)).toContain('ALAMBIC_SCHEMA_EMPTY_OPTIONS');
  });

  it('flags video_url with empty accept array', () => {
    const issues = validateSection(
      section({
        name: 'Hero',
        settings: [video_url({ id: 'vu', label: 'Video', accept: [] })],
      }),
    );
    expect(issues.map((i) => i.code)).toContain('ALAMBIC_SCHEMA_VIDEO_URL_EMPTY_ACCEPT');
  });

  it('rejects mixing local blocks with `@theme` references', () => {
    const issues = validateSection(
      section({
        name: 'Group',
        blocks: [block({ type: 'slide', name: 'Slide' }), block.theme()],
      }),
    );
    expect(issues.map((i) => i.code)).toContain('ALAMBIC_SCHEMA_LOCAL_AND_THEME_BLOCKS');
  });

  it('flags duplicate block types', () => {
    const issues = validateSection(
      section({
        name: 'Group',
        blocks: [block({ type: 'slide', name: 'A' }), block({ type: 'slide', name: 'B' })],
      }),
    );
    expect(issues.map((i) => i.code)).toContain('ALAMBIC_SCHEMA_DUPLICATE_BLOCK_TYPE');
  });
});
