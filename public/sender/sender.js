import { packFrame } from '../../src/protocol/frame.js';
import { encodeBase45 } from '../../src/protocol/base45.js';
import { chunkBuffer } from '../../src/protocol/chunker.js';
import { sha256Hex } from '../../src/protocol/checksum.js';
import { generateSessionId } from '../../src/protocol/session.js';
import { FRAME_TYPES } from '../../src/protocol/constants.js';
import { packSessionMeta, packFileMeta } from '../../src/protocol/fileMeta.js';

// DOM Elements
const tabText = document.getElementById('tabText');
const tabFile = document.getElementById('tabFile');
const textModeGroup = document.getElementById('textModeGroup');
const fileModeGroup = document.getElementById('fileModeGroup');
const payloadInput = document.getElementById('payloadInput');
const fileInput = document.getElementById('fileInput');
const selectedFileInfo = document.getElementById('selectedFileInfo');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileSizeDisplay = document.getElementById('fileSizeDisplay');
const statBytes = document.getElementById('statBytes');
const statSha256 = document.getElementById('statSha256');
const fpsControl = document.getElementById('fpsControl');
const fpsVal = document.getElementById('fpsVal');
const chunkSizeSelect = document.getElementById('chunkSizeSelect');
const ecLevelSelect = document.getElementById('ecLevelSelect');
const qrLayoutSelect = document.getElementById('qrLayoutSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const qrDisplay = document.getElementById('qrDisplay');
const qrOverlay = document.getElementById('qrOverlay');
const frameCounter = document.getElementById('frameCounter');
const actualFpsEl = document.getElementById('actualFps');
const loopCounterEl = document.getElementById('loopCounter');
const pairingUrlEl = document.getElementById('pairingUrl');
const pairingQrDisplay = document.getElementById('pairingQrDisplay');

let currentMode = 'text'; // 'text' or 'file'
let selectedFile = null;
let fileBytes = null;

let isBroadcasting = false;
let broadcastTimer = null;
let currentFrameIndex = 0;
let loopCount = 0;
let frameSequence = [];
let lastFrameTime = 0;
let frameTimes = [];
let qrGenerators = [];

// Tab Switcher
tabText.addEventListener('click', () => {
  currentMode = 'text';
  tabText.classList.add('active');
  tabFile.classList.remove('active');
  textModeGroup.classList.remove('hidden');
  fileModeGroup.classList.add('hidden');
  updatePayloadStats();
});

tabFile.addEventListener('click', () => {
  currentMode = 'file';
  tabFile.classList.add('active');
  tabText.classList.remove('active');
  fileModeGroup.classList.remove('hidden');
  textModeGroup.classList.add('hidden');
  updatePayloadStats();
});

// File Selection Handler
fileInput.addEventListener('change', async (e) => {
  if (e.target.files && e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    const arrayBuffer = await selectedFile.arrayBuffer();
    fileBytes = new Uint8Array(arrayBuffer);

    fileNameDisplay.textContent = selectedFile.name;
    fileSizeDisplay.textContent = `${(selectedFile.size / 1024).toFixed(1)} KB`;
    selectedFileInfo.classList.remove('hidden');

    updatePayloadStats();
  }
});

// Initialize Pairing Info & QR Code
function initPairingInfo() {
  let receiverUrl = `${window.location.origin}${window.location.pathname.replace(/\/sender\/?.*$/, '')}/receiver/`;

  fetch('/api/pairing-info')
    .then(res => res.json())
    .then(data => {
      if (data.url) receiverUrl = data.url;
      renderPairingQr(receiverUrl);
    })
    .catch(() => {
      renderPairingQr(receiverUrl);
    });
}

function renderPairingQr(url) {
  if (pairingUrlEl) pairingUrlEl.textContent = url;
  if (pairingQrDisplay && window.QRCode) {
    pairingQrDisplay.innerHTML = '';
    new window.QRCode(pairingQrDisplay, {
      text: url,
      width: 200,
      height: 200,
      correctLevel: window.QRCode.CorrectLevel.M,
    });
  }
}

initPairingInfo();

// Live Payload Statistics
async function updatePayloadStats() {
  let bytes = new Uint8Array(0);
  if (currentMode === 'text') {
    const text = payloadInput.value;
    bytes = new TextEncoder().encode(text);
  } else if (currentMode === 'file' && fileBytes) {
    bytes = fileBytes;
  }

  statBytes.textContent = bytes.length;
  if (bytes.length > 0) {
    const sha = await sha256Hex(bytes);
    statSha256.textContent = sha.substring(0, 16) + '...';
  } else {
    statSha256.textContent = '-';
  }
}

payloadInput.addEventListener('input', updatePayloadStats);

// Real-time FPS slider update label
fpsControl.addEventListener('input', () => {
  fpsVal.textContent = fpsControl.value;
});

updatePayloadStats();

// Start Broadcasting Engine
async function startBroadcast() {
  let payloadBytes = null;
  let isFilePayload = false;

  if (currentMode === 'text') {
    const text = payloadInput.value;
    if (!text) {
      alert('Please enter a text or JSON payload.');
      return;
    }
    payloadBytes = new TextEncoder().encode(text);
  } else {
    if (!fileBytes || !selectedFile) {
      alert('Please select a file to transmit.');
      return;
    }
    payloadBytes = fileBytes;
    isFilePayload = true;
  }

  const sha256 = await sha256Hex(payloadBytes);
  const chunkSize = parseInt(chunkSizeSelect.value, 10);
  const ecLevel = ecLevelSelect.value;
  const layout = qrLayoutSelect.value;

  const sessionId = generateSessionId();
  const rawChunks = chunkBuffer(payloadBytes, chunkSize);
  const totalChunks = rawChunks.length;

  let metaFrame = null;
  if (isFilePayload) {
    const fileMetaBytes = packFileMeta(selectedFile.name, selectedFile.type || 'application/octet-stream', payloadBytes.length, sha256);
    metaFrame = packFrame(FRAME_TYPES.FILE_META, sessionId, 0, totalChunks, fileMetaBytes);
  } else {
    const textMetaBytes = packSessionMeta(payloadBytes.length, sha256);
    metaFrame = packFrame(FRAME_TYPES.SESSION_META, sessionId, 0, totalChunks, textMetaBytes);
  }

  const encodedMeta = encodeBase45(metaFrame);

  // Build data chunk frames
  const encodedChunks = rawChunks.map((chunk, idx) => {
    const frame = packFrame(FRAME_TYPES.DATA_CHUNK, sessionId, idx, totalChunks, chunk);
    return encodeBase45(frame);
  });

  frameSequence = [encodedMeta, ...encodedChunks];

  isBroadcasting = true;
  currentFrameIndex = 0;
  loopCount = 1;
  frameTimes = [];
  lastFrameTime = performance.now();

  startBtn.disabled = true;
  stopBtn.disabled = false;
  payloadInput.disabled = true;
  fileInput.disabled = true;
  qrOverlay.classList.add('hidden');

  // Determine Multi-QR layout counts & sizes
  let qrCount = 1;
  let qrSize = 340;
  if (layout === '2x1') {
    qrCount = 2;
    qrSize = 175;
  } else if (layout === '2x2') {
    qrCount = 4;
    qrSize = 165;
  }

  // Setup DOM grid cells and QRCode instances
  qrDisplay.innerHTML = '';
  qrDisplay.className = `qr-display layout-${layout}`;
  qrGenerators = [];

  const correctLevelMap = {
    'L': window.QRCode.CorrectLevel.L,
    'M': window.QRCode.CorrectLevel.M,
    'Q': window.QRCode.CorrectLevel.Q,
    'H': window.QRCode.CorrectLevel.H,
  };

  for (let i = 0; i < qrCount; i++) {
    const cell = document.createElement('div');
    cell.className = 'qr-cell';
    cell.id = `qr-cell-${i}`;
    qrDisplay.appendChild(cell);

    const qrInstance = new window.QRCode(cell, {
      width: qrSize,
      height: qrSize,
      correctLevel: correctLevelMap[ecLevel] !== undefined ? correctLevelMap[ecLevel] : window.QRCode.CorrectLevel.M,
    });
    qrGenerators.push(qrInstance);
  }

  renderNextFrame();
}

function renderNextFrame() {
  if (!isBroadcasting) return;

  // DYNAMIC REAL-TIME FPS: Read current slider value on every frame tick!
  const targetFps = parseInt(fpsControl.value, 10);
  const now = performance.now();
  const delta = now - lastFrameTime;
  const interval = 1000 / targetFps;

  if (delta >= interval) {
    lastFrameTime = now - (delta % interval);

    // Calculate actual FPS
    frameTimes.push(now);
    if (frameTimes.length > 20) frameTimes.shift();
    if (frameTimes.length > 1) {
      const duration = (frameTimes[frameTimes.length - 1] - frameTimes[0]) / 1000;
      actualFpsEl.textContent = ((frameTimes.length - 1) / duration).toFixed(1);
    }

    const qrCount = qrGenerators.length;

    // Render multi-QR grid cells
    for (let i = 0; i < qrCount; i++) {
      const seqIndex = (currentFrameIndex + i) % frameSequence.length;
      const qrString = frameSequence[seqIndex];
      qrGenerators[i].makeCode(qrString);
    }

    // Update UI counters
    const startIdx = currentFrameIndex;
    const endIdx = Math.min(currentFrameIndex + qrCount - 1, frameSequence.length - 1);
    if (qrCount === 1) {
      frameCounter.textContent = `CHUNK ${startIdx}/${frameSequence.length - 1}`;
    } else {
      frameCounter.textContent = `CHUNKS ${startIdx}-${endIdx}/${frameSequence.length - 1}`;
    }
    loopCounterEl.textContent = loopCount;

    // Advance frame index by QR count
    currentFrameIndex += qrCount;
    if (currentFrameIndex >= frameSequence.length) {
      currentFrameIndex = 0;
      loopCount++;
    }
  }

  broadcastTimer = requestAnimationFrame(renderNextFrame);
}

function stopBroadcast() {
  isBroadcasting = false;
  if (broadcastTimer) cancelAnimationFrame(broadcastTimer);

  startBtn.disabled = false;
  stopBtn.disabled = true;
  payloadInput.disabled = false;
  fileInput.disabled = false;
  qrOverlay.classList.remove('hidden');
  actualFpsEl.textContent = '0.0';
  frameCounter.textContent = 'Frame - / -';
}

startBtn.addEventListener('click', startBroadcast);
stopBtn.addEventListener('click', stopBroadcast);
