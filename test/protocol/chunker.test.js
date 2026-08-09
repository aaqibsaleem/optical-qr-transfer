import { describe, it, expect } from 'vitest';
import { chunkBuffer } from '../../src/protocol/chunker.js';

describe('Chunker Utility', () => {
  it('splits buffer into chunks of specified size', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const chunks = chunkBuffer(data, 3);

    expect(chunks.length).toBe(4);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(chunks[1]).toEqual(new Uint8Array([4, 5, 6]));
    expect(chunks[2]).toEqual(new Uint8Array([7, 8, 9]));
    expect(chunks[3]).toEqual(new Uint8Array([10]));
  });

  it('handles empty buffer gracefully', () => {
    const chunks = chunkBuffer(new Uint8Array(0), 10);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(0);
  });
});
