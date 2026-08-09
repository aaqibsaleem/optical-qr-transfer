import { unpackFrame } from '../../src/protocol/frame.js';
import { decodeBase45 } from '../../src/protocol/base45.js';
import { Reassembler } from '../../src/protocol/reassembler.js';
import { FRAME_TYPES } from '../../src/protocol/constants.js';
import { unpackSessionMeta, unpackFileMeta } from '../../src/protocol/fileMeta.js';

// DOM Elements
const videoFeed = document.getElementById('videoFeed');
const overlayCanvas = document.getElementById('overlayCanvas');
const cameraPrompt = document.getElementById('cameraPrompt');
const startCamBtn = document.getElementById('startCamBtn');
const statePill = document.getElementById('statePill');
const stateText = document.getElementById('stateText');
const progressStats = document.getElementById('progressStats');
const progressBarFill = document.getElementById('progressBarFill');
const chunkGrid = document.getElementById('chunkGrid');
const resultSection = document.getElementById('resultSection');
const resultMetaBadge = document.getElementById('resultMetaBadge');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const textResultContainer = document.getElementById('textResultContainer');
const resultText = document.getElementById('resultText');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');

let overlayCtx = null;
let decodeWorker = null;
let isWorkerProcessing = false;

// Session State
let currentSessionId = null;
let reassembler = null;
let receivedMeta = false;
let isCompleted = false;
let metaDetails = { fileName: null, mimeType: 'text/plain' };

// Initialize Web Worker for QR decoding
function initWorker() {
  decodeWorker = new Worker('../../src/workers/decodeWorker.js');

  decodeWorker.onmessage = (event) => {
    isWorkerProcessing = false;
    const { success, results } = event.data;

    if (success && results && results.length > 0) {
      drawBoundingBoxes(results);
      for (const item of results) {
        if (item.data) {
          handleScannedQrData(item.data);
        }
      }
    } else {
      clearOverlay();
    }
  };

  decodeWorker.onerror = (err) => {
    console.error('Worker error:', err);
    isWorkerProcessing = false;
  };
}

// Start Camera Stream via getUserMedia
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    videoFeed.srcObject = stream;
    await videoFeed.play();

    overlayCanvas.width = videoFeed.videoWidth || 640;
    overlayCanvas.height = videoFeed.videoHeight || 480;
    overlayCtx = overlayCanvas.getContext('2d');

    cameraPrompt.classList.add('hidden');
    initWorker();
    requestAnimationFrame(scanFrame);
  } catch (err) {
    alert('Camera access failed: ' + err.message + '. Please ensure HTTPS and permissions are granted.');
    console.error('Camera error:', err);
  }
}

// Scanning Loop
function scanFrame() {
  if (videoFeed.readyState === videoFeed.HAVE_ENOUGH_DATA && !isWorkerProcessing && decodeWorker) {
    const canvas = document.createElement('canvas');
    canvas.width = videoFeed.videoWidth;
    canvas.height = videoFeed.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    isWorkerProcessing = true;

    if (window.createImageBitmap) {
      createImageBitmap(imageData).then((imageBitmap) => {
        decodeWorker.postMessage({
          data: imageData.data,
          width: canvas.width,
          height: canvas.height,
          imageBitmap: imageBitmap,
        }, [imageBitmap]);
      }).catch(() => {
        decodeWorker.postMessage({
          data: imageData.data,
          width: canvas.width,
          height: canvas.height,
        });
      });
    } else {
      decodeWorker.postMessage({
        data: imageData.data,
        width: canvas.width,
        height: canvas.height,
      });
    }
  }

  requestAnimationFrame(scanFrame);
}

// Draw bounding boxes over ALL detected QR codes in frame
function drawBoundingBoxes(results) {
  if (!overlayCtx || !results) return;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.strokeStyle = '#00f2fe';
  overlayCtx.lineWidth = 4;

  for (const item of results) {
    const location = item.location;
    if (location && location.topLeftCorner) {
      overlayCtx.beginPath();
      overlayCtx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
      overlayCtx.lineTo(location.topRightCorner.x, location.topRightCorner.y);
      overlayCtx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
      overlayCtx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
      overlayCtx.closePath();
      overlayCtx.stroke();
    }
  }
}

function clearOverlay() {
  if (overlayCtx) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }
}

// Reset State for New Session
function resetSessionState(newSessionId, totalChunks) {
  currentSessionId = newSessionId;
  isCompleted = false;
  receivedMeta = false;
  metaDetails = { fileName: null, mimeType: 'text/plain' };

  resultSection.classList.add('hidden');
  imagePreviewContainer.classList.add('hidden');
  textResultContainer.classList.add('hidden');
  downloadBtn.classList.add('hidden');

  buildChunkGrid(totalChunks);
  updateState('receiving', `New Session Detected — Receiving (0/${totalChunks})`);
}

// Process scanned QR payload
async function handleScannedQrData(qrString) {
  try {
    const decodedBytes = decodeBase45(qrString);
    const unpacked = unpackFrame(decodedBytes);

    // AUTO-RESET: Check if session ID changed
    if (currentSessionId === null || currentSessionId !== unpacked.sessionId) {
      resetSessionState(unpacked.sessionId, unpacked.totalChunks);

      if (unpacked.frameType === FRAME_TYPES.SESSION_META) {
        const metaInfo = unpackSessionMeta(unpacked.payload);
        reassembler = new Reassembler(currentSessionId, unpacked.totalChunks, metaInfo.sha256);
        receivedMeta = true;
      } else if (unpacked.frameType === FRAME_TYPES.FILE_META) {
        const fileInfo = unpackFileMeta(unpacked.payload);
        reassembler = new Reassembler(currentSessionId, unpacked.totalChunks, fileInfo.sha256);
        metaDetails = { fileName: fileInfo.fileName, mimeType: fileInfo.mimeType };
        receivedMeta = true;
      } else {
        reassembler = new Reassembler(currentSessionId, unpacked.totalChunks, null);
      }
    }

    if (unpacked.frameType === FRAME_TYPES.SESSION_META) {
      if (!receivedMeta) {
        const metaInfo = unpackSessionMeta(unpacked.payload);
        reassembler.expectedSha256 = metaInfo.sha256 ? metaInfo.sha256.toLowerCase() : null;
        receivedMeta = true;
      }
    } else if (unpacked.frameType === FRAME_TYPES.FILE_META) {
      if (!receivedMeta) {
        const fileInfo = unpackFileMeta(unpacked.payload);
        reassembler.expectedSha256 = fileInfo.sha256 ? fileInfo.sha256.toLowerCase() : null;
        metaDetails = { fileName: fileInfo.fileName, mimeType: fileInfo.mimeType };
        receivedMeta = true;
      }
    } else if (unpacked.frameType === FRAME_TYPES.DATA_CHUNK && reassembler) {
      const isNewChunk = reassembler.addChunk(unpacked.chunkIndex, unpacked.payload);

      if (isNewChunk) {
        markChunkBoxReceived(unpacked.chunkIndex);
        updateProgress();

        if (reassembler.isComplete() && !isCompleted) {
          isCompleted = true;
          await completeTransfer();
        }
      }
    }
  } catch (err) {
    // Ignore non-protocol frames
  }
}

function updateState(type, text) {
  statePill.className = `state-pill ${type}`;
  stateText.textContent = text;
}

function buildChunkGrid(totalChunks) {
  chunkGrid.innerHTML = '';
  for (let i = 0; i < totalChunks; i++) {
    const box = document.createElement('div');
    box.className = 'chunk-box';
    box.id = `chunk-${i}`;
    chunkGrid.appendChild(box);
  }
}

function markChunkBoxReceived(index) {
  const box = document.getElementById(`chunk-${index}`);
  if (box) {
    box.classList.add('received');
  }
}

function updateProgress() {
  if (!reassembler) return;
  const count = reassembler.bitmap.receivedCount();
  const total = reassembler.totalChunks;
  const pct = reassembler.bitmap.progressPercent();

  progressStats.textContent = `${count} / ${total} (${pct}%)`;
  progressBarFill.style.width = `${pct}%`;
  updateState('receiving', `Receiving (${pct}%)`);
}

async function completeTransfer() {
  try {
    updateState('receiving', 'Verifying SHA-256...');
    const payloadBytes = await reassembler.reassemble();
    const mimeType = metaDetails.mimeType || 'application/octet-stream';
    const blob = new Blob([payloadBytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    if (metaDetails.fileName) {
      resultMetaBadge.textContent = metaDetails.fileName;
    } else {
      resultMetaBadge.textContent = 'Text / JSON';
    }

    if (mimeType.startsWith('image/')) {
      imagePreview.src = blobUrl;
      imagePreviewContainer.classList.remove('hidden');
      textResultContainer.classList.add('hidden');
    } else {
      const text = new TextDecoder().decode(payloadBytes);
      resultText.textContent = text;
      textResultContainer.classList.remove('hidden');
      imagePreviewContainer.classList.add('hidden');
    }

    // Configure Download Button
    downloadBtn.href = blobUrl;
    downloadBtn.download = metaDetails.fileName || 'received-data.bin';
    downloadBtn.classList.remove('hidden');

    resultSection.classList.remove('hidden');
    updateState('complete', 'Complete — verified ✓');
  } catch (err) {
    updateState('error', 'CHECKSUM MISMATCH ✗');
    alert('Transfer failed checksum verification: ' + err.message);
  }
}

// Setup Event Listeners
startCamBtn.addEventListener('click', startCamera);
copyBtn.addEventListener('click', () => {
  if (resultText.textContent) {
    navigator.clipboard.writeText(resultText.textContent).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Text'; }, 2000);
    });
  }
});
