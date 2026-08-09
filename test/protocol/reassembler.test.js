import { describe, it, expect } from 'vitest';
import { Reassembler } from '../../src/protocol/reassembler.js';
import { sha256Hex } from '../../src/protocol/checksum.js';

describe('Reassembler', () => {
  it('reassembles out-of-order chunks correctly and validates SHA-256', async () => {
    const p1 = new TextEncoder().encode('Hello ');
    const p2 = new TextEncoder().encode('Air-Gapped ');
    const p3 = new TextEncoder().encode('World!');

    const full = new Uint8Array([...p1, ...p2, ...p3]);
    const expectedSha = await sha256Hex(full);

    const reassembler = new Reassembler(100, 3, expectedSha);

    // Add chunks out of order
    reassembler.addChunk(1, p2);
    reassembler.addChunk(0, p1);
    expect(reassembler.isComplete()).toBe(false);

    reassembler.addChunk(2, p3);
    expect(reassembler.isComplete()).toBe(true);

    const result = await reassembler.reassemble();
    expect(new TextDecoder().decode(result)).toBe('Hello Air-Gapped World!');
  });

  it('fails SHA-256 validation if data is mismatched', async () => {
    const p1 = new TextEncoder().encode('Good ');
    const p2 = new TextEncoder().encode('Data');
    const reassembler = new Reassembler(100, 2, 'badsha256hash1234567890abcdef1234567890abcdef1234567890abcdef1234');

    reassembler.addChunk(0, p1);
    reassembler.addChunk(1, p2);

    await expect(reassembler.reassemble()).rejects.toThrow(/SHA-256 integrity check failed/);
  });
});
