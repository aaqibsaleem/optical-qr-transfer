import { MAGIC_BYTES, PROTOCOL_VERSION, HEADER_SIZE } from './constants.js';
import { crc32 } from './checksum.js';

/**
 * Header Layout (18 bytes):
 * [0..1]   Magic Bytes (0x51, 0x52)
 * [2]      Version (0x01)
 * [3]      FrameType (0x00 SESSION_META, 0x01 DATA_CHUNK, 0x02 FILE_META)
 * [4..7]   SessionId (4 bytes uint32 BigEndian)
 * [8..10]  ChunkIndex (3 bytes uint24 BigEndian)
 * [11..13] TotalChunks (3 bytes uint24 BigEndian)
 * [14..17] Payload CRC32 (4 bytes uint32 BigEndian)
 * [18..]   Payload (variable size)
 */

export function packFrame(frameType, sessionId, chunkIndex, totalChunks, payload = new Uint8Array(0)) {
  const frame = new Uint8Array(HEADER_SIZE + payload.length);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);

  // Magic
  frame[0] = MAGIC_BYTES[0];
  frame[1] = MAGIC_BYTES[1];
  // Version
  frame[2] = PROTOCOL_VERSION;
  // FrameType
  frame[3] = frameType & 0xff;

  // SessionId (4 bytes)
  view.setUint32(4, sessionId >>> 0, false);

  // ChunkIndex (3 bytes, big-endian)
  frame[8] = (chunkIndex >> 16) & 0xff;
  frame[9] = (chunkIndex >> 8) & 0xff;
  frame[10] = chunkIndex & 0xff;

  // TotalChunks (3 bytes, big-endian)
  frame[11] = (totalChunks >> 16) & 0xff;
  frame[12] = (totalChunks >> 8) & 0xff;
  frame[13] = totalChunks & 0xff;

  // CRC32 of payload
  const payloadCrc = crc32(payload);
  view.setUint32(14, payloadCrc, false);

  // Copy payload
  frame.set(payload, HEADER_SIZE);

  return frame;
}

export function unpackFrame(frameBytes) {
  if (frameBytes.length < HEADER_SIZE) {
    throw new Error(`Frame too small: ${frameBytes.length} bytes (header requires ${HEADER_SIZE})`);
  }

  // Magic check
  if (frameBytes[0] !== MAGIC_BYTES[0] || frameBytes[1] !== MAGIC_BYTES[1]) {
    throw new Error('Invalid magic bytes');
  }

  // Version check
  const version = frameBytes[2];
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version: ${version}`);
  }

  const frameType = frameBytes[3];
  const view = new DataView(frameBytes.buffer, frameBytes.byteOffset, frameBytes.byteLength);

  const sessionId = view.getUint32(4, false);

  const chunkIndex = (frameBytes[8] << 16) | (frameBytes[9] << 8) | frameBytes[10];
  const totalChunks = (frameBytes[11] << 16) | (frameBytes[12] << 8) | frameBytes[13];

  const expectedCrc = view.getUint32(14, false);
  const payload = frameBytes.subarray(HEADER_SIZE);
  const actualCrc = crc32(payload);

  if (actualCrc !== expectedCrc) {
    throw new Error(`Payload CRC32 mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`);
  }

  return {
    version,
    frameType,
    sessionId,
    chunkIndex,
    totalChunks,
    payloadChecksum: expectedCrc,
    payload,
  };
}
