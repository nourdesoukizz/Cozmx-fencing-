import { describe, it, expect } from 'vitest';
import {
  validateScoresClient,
  computeResultsClient,
  isCellProblematic,
} from '../utils/scoreValidation.js';

// ── validateScoresClient ────────────────────────────────────

describe('validateScoresClient', () => {
  it('returns error for empty matrix', () => {
    const result = validateScoresClient([], []);
    expect(result.some(a => a.level === 'error' && a.message.includes('Empty'))).toBe(true);
  });

  it('returns no errors for valid 3x3', () => {
    const matrix = [
      [null, 5, 5],
      [3, null, 5],
      [2, 1, null],
    ];
    const fencers = [{ last_name: 'A' }, { last_name: 'B' }, { last_name: 'C' }];
    const anomalies = validateScoresClient(matrix, fencers);
    const errors = anomalies.filter(a => a.level === 'error');
    expect(errors).toHaveLength(0);
  });

  it('indicator sum is always zero for valid NxN matrix', () => {
    const matrix = [
      [null, 4, 5],
      [3, null, 5],
      [2, 1, null],
    ];
    const fencers = [{ last_name: 'A' }, { last_name: 'B' }, { last_name: 'C' }];
    const anomalies = validateScoresClient(matrix, fencers);
    expect(anomalies.some(a => a.message.includes('Indicator'))).toBe(false);
  });

  it('detects out-of-range score', () => {
    const matrix = [
      [null, 7],
      [3, null],
    ];
    const fencers = [{ last_name: 'A' }, { last_name: 'B' }];
    const anomalies = validateScoresClient(matrix, fencers);
    expect(anomalies.some(a => a.message.includes('out of 0-5 range'))).toBe(true);
  });

  it('detects tied bout', () => {
    const matrix = [
      [null, 3],
      [3, null],
    ];
    const fencers = [{ last_name: 'A' }, { last_name: 'B' }];
    const anomalies = validateScoresClient(matrix, fencers);
    expect(anomalies.some(a => a.message.includes('tied'))).toBe(true);
  });

  it('warns when neither scored 5', () => {
    const matrix = [
      [null, 4],
      [3, null],
    ];
    const fencers = [{ last_name: 'A' }, { last_name: 'B' }];
    const anomalies = validateScoresClient(matrix, fencers);
    expect(anomalies.some(a => a.level === 'warning' && a.message.includes('neither scored 5'))).toBe(true);
  });
});

// ── computeResultsClient ────────────────────────────────────

describe('computeResultsClient', () => {
  it('computes correct V/TS/TR for 3x3', () => {
    const matrix = [
      [null, 5, 5],
      [3, null, 5],
      [2, 1, null],
    ];
    const fencers = [
      { first_name: 'Al', last_name: 'A' },
      { first_name: 'Bo', last_name: 'B' },
      { first_name: 'Ca', last_name: 'C' },
    ];
    const results = computeResultsClient(matrix, fencers);
    expect(results).toHaveLength(3);

    const a = results.find(r => r.last_name === 'A');
    expect(a.V).toBe(2);
    expect(a.TS).toBe(10);
    expect(a.TR).toBe(5);
    expect(a.indicator).toBe(5);
  });

  it('assigns sequential places', () => {
    const matrix = [
      [null, 5, 5],
      [3, null, 5],
      [2, 1, null],
    ];
    const fencers = [
      { first_name: 'A', last_name: 'A' },
      { first_name: 'B', last_name: 'B' },
      { first_name: 'C', last_name: 'C' },
    ];
    const results = computeResultsClient(matrix, fencers);
    const places = results.map(r => r.place);
    expect(places).toEqual([1, 2, 3]);
  });

  it('handles null scores gracefully', () => {
    const matrix = [
      [null, null],
      [null, null],
    ];
    const fencers = [
      { first_name: 'A', last_name: 'A' },
      { first_name: 'B', last_name: 'B' },
    ];
    const results = computeResultsClient(matrix, fencers);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.V === 0)).toBe(true);
    expect(results.every(r => r.TS === 0)).toBe(true);
  });

  it('sorts by V desc, then indicator desc, then TS desc', () => {
    // Fencer A: 1V, ind=3, TS=8
    // Fencer B: 1V, ind=3, TS=8
    // Fencer C: 0V, ind=-6, TS=4
    const matrix = [
      [null, 5, 3],
      [2, null, 5],
      [5, 1, null],
    ];
    const fencers = [
      { first_name: 'A', last_name: 'A' },
      { first_name: 'B', last_name: 'B' },
      { first_name: 'C', last_name: 'C' },
    ];
    const results = computeResultsClient(matrix, fencers);
    // All should have place 1, 2, 3
    expect(results[0].place).toBe(1);
    expect(results[2].place).toBe(3);
  });
});

// ── isCellProblematic ───────────────────────────────────────

describe('isCellProblematic', () => {
  it('returns false for diagonal cell', () => {
    expect(isCellProblematic(1, 1, 5, 0.9)).toBe(false);
  });

  it('returns true for null value', () => {
    expect(isCellProblematic(0, 1, null, 0.9)).toBe(true);
  });

  it('returns true for undefined value', () => {
    expect(isCellProblematic(0, 1, undefined, 0.9)).toBe(true);
  });

  it('returns true for out-of-range value (negative)', () => {
    expect(isCellProblematic(0, 1, -1, 0.9)).toBe(true);
  });

  it('returns true for out-of-range value (>5)', () => {
    expect(isCellProblematic(0, 1, 6, 0.9)).toBe(true);
  });

  it('returns true for low confidence', () => {
    expect(isCellProblematic(0, 1, 3, 0.5)).toBe(true);
  });

  it('returns false for valid cell', () => {
    expect(isCellProblematic(0, 1, 4, 0.9)).toBe(false);
  });

  it('returns false when confidence is null', () => {
    expect(isCellProblematic(0, 1, 3, null)).toBe(false);
  });
});
