/**
 * Receiver bitset bitmap for chunk tracking.
 */

export class Bitmap {
  constructor(totalChunks) {
    if (totalChunks <= 0) {
      throw new Error("totalChunks must be > 0");
    }
    this.totalChunks = totalChunks;
    this.received = new Set();
  }

  mark(chunkIndex) {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) {
      return false;
    }
    const isNew = !this.received.has(chunkIndex);
    this.received.add(chunkIndex);
    return isNew;
  }

  has(chunkIndex) {
    return this.received.has(chunkIndex);
  }

  receivedCount() {
    return this.received.size;
  }

  progressPercent() {
    return Math.floor((this.received.size / this.totalChunks) * 100);
  }

  isComplete() {
    return this.received.size === this.totalChunks;
  }

  reset() {
    this.received.clear();
  }
}
