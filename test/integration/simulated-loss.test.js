import { describe, it, expect } from 'vitest';
import { packFrame, unpackFrame } from '../../src/protocol/frame.js';
import { encodeBase45, decodeBase45 } from '../../src/protocol/base45.js';
import { chunkBuffer } from '../../src/protocol/chunker.js';
import { sha256Hex } from '../../src/protocol/checksum.js';
import { Reassembler } from '../../src/protocol/reassembler.js';
import { FRAME_TYPES } from '../../src/protocol/constants.js';
import { packSessionMeta, unpackSessionMeta } from '../../src/protocol/fileMeta.js';

describe('Simulated Optical Frame Loss Integration Test', () => {
  it('reconstructs payload over cyclic broadcast despite 30% random frame loss per cycle', async () => {
    // 1. Generate a sample payload (approx 2KB text/JSON data)
    const sampleData = JSON.stringify({
      title: 'Air-Gapped QR Transfer Test Payload',
      description: 'Simulating unreliable camera scanning over cyclic QR stream',
      items: Array.from({ length: 50 }, (_, i) => ({ id: i, value: `Item payload string #${i}` })),
    });

    const payloadBytes = new TextEncoder().encode(sampleData);
    const expectedSha256 = await sha256Hex(payloadBytes);

    // 2. Sender Pipeline: Chunk payload & wrap in binary Base45 encoded frames
    const chunkSize = 60; // 60 bytes per chunk
    const rawChunks = chunkBuffer(payloadBytes, chunkSize);
    const totalChunks = rawChunks.length;
    const sessionId = 0x99887766;

    // Create SESSION_META frame
    const metaBytes = packSessionMeta(payloadBytes.length, expectedSha256);
    const metaFrame = packFrame(FRAME_TYPES.SESSION_META, sessionId, 0, totalChunks, metaBytes);
    const encodedMeta = encodeBase45(metaFrame);

    // Create DATA_CHUNK frames
    const encodedDataFrames = rawChunks.map((chunk, idx) => {
      const frame = packFrame(FRAME_TYPES.DATA_CHUNK, sessionId, idx, totalChunks, chunk);
      return encodeBase45(frame);
    });

    const fullSequence = [encodedMeta, ...encodedDataFrames];

    // 3. Receiver Pipeline: Simulate scanning cyclic broadcast with 30% frame loss per loop
    let reassembler = null;
    let receivedMeta = false;

    // Pseudo-random deterministic drop pattern
    let seed = 42;
    function pseudoRandom() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    let cycleCount = 0;
    const maxCycles = 10;

    while (cycleCount < maxCycles && (!reassembler || !reassembler.isComplete())) {
      cycleCount++;

      for (const qrString of fullSequence) {
        // Drop ~30% of frames
        if (pseudoRandom() < 0.30) {
          continue; // Frame lost in transmission / camera blur
        }

        // Scan decode
        const decodedBytes = decodeBase45(qrString);
        const unpacked = unpackFrame(decodedBytes);

        if (unpacked.sessionId !== sessionId) continue;

        if (unpacked.frameType === FRAME_TYPES.SESSION_META) {
          if (!receivedMeta) {
            const metaInfo = unpackSessionMeta(unpacked.payload);
            reassembler = new Reassembler(sessionId, unpacked.totalChunks, metaInfo.sha256);
            receivedMeta = true;
          }
        } else if (unpacked.frameType === FRAME_TYPES.DATA_CHUNK && reassembler) {
          reassembler.addChunk(unpacked.chunkIndex, unpacked.payload);
        }
      }
    }

    expect(receivedMeta).toBe(true);
    expect(reassembler).not.toBeNull();
    expect(reassembler.isComplete()).toBe(true);

    const reassembledBytes = await reassembler.reassemble();
    const resultText = new TextDecoder().decode(reassembledBytes);

    expect(resultText).toBe(sampleData);
    console.log(`✓ Completed loss-tolerant optical transfer in ${cycleCount} simulated broadcast loops!`);
  });
});
