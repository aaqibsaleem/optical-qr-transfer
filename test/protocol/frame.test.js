import { describe, it, expect } from 'vitest';
import { packFrame, unpackFrame } from '../../src/protocol/frame.js';
import { FRAME_TYPES } from '../../src/protocol/constants.js';

describe('Binary Frame Pack / Unpack', () => {
  it('packs and unpacks a frame accurately', () => {
    const payload = new TextEncoder().encode('Test Chunk Payload');
    const sessionId = 0x12345678;
    const chunkIndex = 5;
    const totalChunks = 20;

    const frameBytes = packFrame(FRAME_TYPES.DATA_CHUNK, sessionId, chunkIndex, totalChunks, payload);
    const unpacked = unpackFrame(frameBytes);

    expect(unpacked.version).toBe(1);
    expect(unpacked.frameType).toBe(FRAME_TYPES.DATA_CHUNK);
    expect(unpacked.sessionId).toBe(sessionId);
    expect(unpacked.chunkIndex).toBe(chunkIndex);
    expect(unpacked.totalChunks).toBe(totalChunks);
    expect(new TextDecoder().decode(unpacked.payload)).toBe('Test Chunk Payload');
  });

  it('rejects frame with invalid CRC32 payload checksum', () => {
    const payload = new TextEncoder().encode('Intact Data');
    const frameBytes = packFrame(FRAME_TYPES.DATA_CHUNK, 100, 0, 1, payload);

    // Corrupt one byte of payload in the frame
    frameBytes[frameBytes.length - 1] ^= 0xff;

    expect(() => unpackFrame(frameBytes)).toThrow(/CRC32 mismatch/);
  });

  it('rejects frame with bad magic bytes', () => {
    const payload = new Uint8Array([1, 2, 3]);
    const frameBytes = packFrame(FRAME_TYPES.DATA_CHUNK, 100, 0, 1, payload);
    frameBytes[0] = 0x00;

    expect(() => unpackFrame(frameBytes)).toThrow(/Invalid magic bytes/);
  });
});
