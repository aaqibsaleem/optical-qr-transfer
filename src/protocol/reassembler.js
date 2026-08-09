import { Bitmap } from './bitmap.js';
import { sha256Hex } from './checksum.js';

export class Reassembler {
  constructor(sessionId, totalChunks, expectedSha256) {
    this.sessionId = sessionId;
    this.totalChunks = totalChunks;
    this.expectedSha256 = expectedSha256 ? expectedSha256.toLowerCase() : null;
    this.bitmap = new Bitmap(totalChunks);
    this.chunks = new Array(totalChunks);
  }

  addChunk(chunkIndex, payload) {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) {
      throw new Error(`Chunk index ${chunkIndex} out of bounds (total: ${this.totalChunks})`);
    }

    const isNew = this.bitmap.mark(chunkIndex);
    if (isNew) {
      this.chunks[chunkIndex] = new Uint8Array(payload);
    }
    return isNew;
  }

  isComplete() {
    return this.bitmap.isComplete();
  }

  async reassemble() {
    if (!this.isComplete()) {
      throw new Error(`Reassembly incomplete (${this.bitmap.receivedCount()}/${this.totalChunks} chunks)`);
    }

    let totalLength = 0;
    for (let i = 0; i < this.totalChunks; i++) {
      totalLength += this.chunks[i].length;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (let i = 0; i < this.totalChunks; i++) {
      result.set(this.chunks[i], offset);
      offset += this.chunks[i].length;
    }

    if (this.expectedSha256) {
      const actualSha256 = (await sha256Hex(result)).toLowerCase();
      if (actualSha256 !== this.expectedSha256) {
        throw new Error(`SHA-256 integrity check failed! Expected ${this.expectedSha256}, got ${actualSha256}`);
      }
    }

    return result;
  }
}
