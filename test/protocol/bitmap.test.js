import { describe, it, expect } from 'vitest';
import { Bitmap } from '../../src/protocol/bitmap.js';

describe('Bitmap Chunk Tracker', () => {
  it('tracks marked chunks and checks completion', () => {
    const bitmap = new Bitmap(3);
    expect(bitmap.isComplete()).toBe(false);

    expect(bitmap.mark(0)).toBe(true);
    expect(bitmap.mark(0)).toBe(false); // Duplicate mark is idempotent

    expect(bitmap.mark(1)).toBe(true);
    expect(bitmap.isComplete()).toBe(false);

    expect(bitmap.mark(2)).toBe(true);
    expect(bitmap.isComplete()).toBe(true);
    expect(bitmap.progressPercent()).toBe(100);
  });
});
