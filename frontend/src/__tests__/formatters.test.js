import { describe, it, expect } from 'vitest';
import {
  formatRefereeName,
  formatFencerName,
  formatEventShort,
  formatStripNumber,
  capitalize,
} from '../utils/formatters.js';

// ── formatRefereeName ───────────────────────────────────────

describe('formatRefereeName', () => {
  it('formats referee object as "Last, First"', () => {
    expect(formatRefereeName({ last_name: 'Smith', first_name: 'John' }))
      .toBe('Smith, John');
  });

  it('returns "Unassigned" for null', () => {
    expect(formatRefereeName(null)).toBe('Unassigned');
  });

  it('returns "Unassigned" for undefined', () => {
    expect(formatRefereeName(undefined)).toBe('Unassigned');
  });
});

// ── formatFencerName ────────────────────────────────────────

describe('formatFencerName', () => {
  it('formats fencer object as "Last, First"', () => {
    expect(formatFencerName({ last_name: 'Doe', first_name: 'Jane' }))
      .toBe('Doe, Jane');
  });

  it('returns empty string for null', () => {
    expect(formatFencerName(null)).toBe('');
  });
});

// ── formatEventShort ────────────────────────────────────────

describe('formatEventShort', () => {
  it('maps "Cadet Men Saber" to "CMS"', () => {
    expect(formatEventShort('Cadet Men Saber')).toBe('CMS');
  });

  it('maps "Y-14 Women Foil" to "YWF"', () => {
    expect(formatEventShort('Y-14 Women Foil')).toBe('YWF');
  });

  it('passes through unknown events', () => {
    expect(formatEventShort('Open Epee')).toBe('Open Epee');
  });

  it('returns empty string for null', () => {
    expect(formatEventShort(null)).toBe('');
  });
});

// ── formatStripNumber ───────────────────────────────────────

describe('formatStripNumber', () => {
  it('prepends "Strip " to value', () => {
    expect(formatStripNumber('F1')).toBe('Strip F1');
  });

  it('returns dash for null', () => {
    expect(formatStripNumber(null)).toBe('—');
  });

  it('returns dash for empty string', () => {
    expect(formatStripNumber('')).toBe('—');
  });
});

// ── capitalize ──────────────────────────────────────────────

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('replaces underscores with spaces', () => {
    expect(capitalize('not_started')).toBe('Not started');
  });

  it('returns empty string for null', () => {
    expect(capitalize(null)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(capitalize('')).toBe('');
  });
});
