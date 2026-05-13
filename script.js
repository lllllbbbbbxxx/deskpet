const videoInput = document.querySelector("#videoInput");
const dropZone = document.querySelector("#dropZone");
const sourceVideo = document.querySelector("#sourceVideo");
const sourceEmpty = document.querySelector("#sourceEmpty");
const processBtn = document.querySelector("#processBtn");
const launchPetBtn = document.querySelector("#launchPetBtn");
const fileState = document.querySelector("#fileState");
const processState = document.querySelector("#processState");
const previewEmpty = document.querySelector("#previewEmpty");
const canvas = document.querySelector("#petCanvas");
const ctx = canvas.getContext("2d", { alpha: true });
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
const rawCompareCanvas = document.querySelector("#rawCompareCanvas");
const keyedCompareCanvas = document.querySelector("#keyedCompareCanvas");
const rawCompareCtx = rawCompareCanvas.getContext("2d", { alpha: true });
const keyedCompareCtx = keyedCompareCanvas.getContext("2d", { alpha: true });
const sizeRange = document.querySelector("#sizeRange");
const speedRange = document.querySelector("#speedRange");
const keyTolerance = document.querySelector("#keyTolerance");
const colorMatchRange = document.querySelector("#colorMatchRange");
const shadowLiftRange = document.querySelector("#shadowLiftRange");
const keyframeRadiusRange = document.querySelector("#keyframeRadiusRange");
const frameScrubber = document.querySelector("#frameScrubber");
const frameEditState = document.querySelector("#frameEditState");
const clearGroundLineBtn = document.querySelector("#clearGroundLineBtn");
const trackPointBtn = document.querySelector("#trackPointBtn");
const petAssetCard = document.querySelector("#petAssetCard");
const assetThumbCanvas = document.querySelector("#assetThumbCanvas");
const assetThumbCtx = assetThumbCanvas.getContext("2d", { alpha: true });
const assetMeta = document.querySelector("#assetMeta");
const savePackageBtn = document.querySelector("#savePackageBtn");
const launchPackageBtn = document.querySelector("#launchPackageBtn");
const savedPackageState = document.querySelector("#savedPackageState");
const savedPackageList = document.querySelector("#savedPackageList");
const edgeMode = document.querySelector("#edgeMode");
const autoAlign = document.querySelector("#autoAlign");
const pingPongLoop = document.querySelector("#pingPongLoop");
const screenEdge = document.querySelector("#screenEdge");

let sourceUrl = "";
let sourceFilePath = "";
let rawFrames = [];
let capturedFrames = [];
let frames = [];
let frameIndex = 0;
let animationTimer = 0;
let previewScale = Number(sizeRange.value) / 100;
let editFrameIndex = 0;
let compareLayout = null;
let pendingGroundPoint = null;
let trackingPointMode = false;
let trackedPoints = [];
const groundLines = new Map();

function setState(element, text) {
  element.textContent = text;
}

function loadFile(file) {
  if (!file || !file.type.startsWith("video/")) {
    setState(fileState, "Choose a video");
    return;
  }

  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
  }

  sourceFilePath = window.deskpetAPI?.getFilePath ? window.deskpetAPI.getFilePath(file) : "";
  frames = [];
  rawFrames = [];
  capturedFrames = [];
  groundLines.clear();
  trackedPoints = [];
  editFrameIndex = 0;
  pendingGroundPoint = null;
  trackingPointMode = false;
  syncFrameEditor();
  clearCanvas();
  clearCompareCanvases();
  hideAssetCard();
  sourceUrl = URL.createObjectURL(file);
  sourceVideo.src = sourceUrl;
  sourceVideo.load();
  sourceEmpty.classList.add("is-hidden");
  previewEmpty.classList.remove("is-hidden");
  processBtn.disabled = false;
  launchPetBtn.disabled = true;
  setState(fileState, file.name);
  setState(processState, "Ready");
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearCompareCanvases() {
  rawCompareCtx.clearRect(0, 0, rawCompareCanvas.width, rawCompareCanvas.height);
  keyedCompareCtx.clearRect(0, 0, keyedCompareCanvas.width, keyedCompareCanvas.height);
}

function drawCanvasFit(targetCanvas, targetCtx, image) {
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  if (!image) return;

  const ratio = image.width / image.height;
  let targetWidth = targetCanvas.width;
  let targetHeight = targetWidth / ratio;

  if (targetHeight > targetCanvas.height) {
    targetHeight = targetCanvas.height;
    targetWidth = targetHeight * ratio;
  }

  const x = (targetCanvas.width - targetWidth) / 2;
  const y = (targetCanvas.height - targetHeight) / 2;
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";
  targetCtx.drawImage(image, x, y, targetWidth, targetHeight);

  return {
    x,
    y,
    width: targetWidth,
    height: targetHeight,
    sourceWidth: image.width,
    sourceHeight: image.height,
  };
}

function drawFrame(image) {
  clearCanvas();
  if (!image) return;

  const targetHeight = canvas.height * 0.82 * previewScale;
  const ratio = image.width / image.height;
  const targetWidth = targetHeight * ratio;
  const x = (canvas.width - targetWidth) / 2;
  const y = canvas.height - targetHeight - 4;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, targetWidth, targetHeight);

}

function hideAssetCard() {
  petAssetCard.classList.add("is-hidden");
  savePackageBtn.disabled = true;
  launchPackageBtn.disabled = true;
  assetThumbCtx.clearRect(0, 0, assetThumbCanvas.width, assetThumbCanvas.height);
  assetMeta.textContent = "Process a video to save or drag out the package";
}

function updateAssetCard() {
  if (!frames.length) {
    hideAssetCard();
    return;
  }

  petAssetCard.classList.remove("is-hidden");
  savePackageBtn.disabled = false;
  launchPackageBtn.disabled = false;
  assetMeta.textContent = `${frames.length} frames / ${speedRange.value} fps`;
  drawCanvasFit(assetThumbCanvas, assetThumbCtx, frames[0]);
}

function startPreview() {
  window.clearInterval(animationTimer);
  if (!frames.length) return;

  frameIndex = 0;
  drawFrame(frames[frameIndex]);
  const interval = 1000 / Number(speedRange.value);

  animationTimer = window.setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    drawFrame(frames[frameIndex]);
  }, interval);
}

function captureFrame(video, time) {
  return new Promise((resolve) => {
    const offscreen = document.createElement("canvas");
    const maxWidth = Math.min(1280, video.videoWidth || 960);
    const ratio = video.videoWidth / video.videoHeight || 1;
    offscreen.width = maxWidth;
    offscreen.height = Math.round(maxWidth / ratio);
    const offscreenCtx = offscreen.getContext("2d", { alpha: true });
    offscreenCtx.imageSmoothingEnabled = true;
    offscreenCtx.imageSmoothingQuality = "high";

    function onSeeked() {
      video.removeEventListener("seeked", onSeeked);
      offscreenCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      offscreenCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      resolve(offscreen);
    }

    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = time;
  });
}

function loadImageToCanvas(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const frame = document.createElement("canvas");
      frame.width = image.naturalWidth;
      frame.height = image.naturalHeight;
      const frameCtx = frame.getContext("2d", { alpha: true });
      frameCtx.drawImage(image, 0, 0);
      resolve(frame);
    };
    image.onerror = reject;
    image.src = src;
  });
}

function summarizeVideoColorInfo(probeResult) {
  const stream = probeResult?.data?.streams?.[0];
  if (!stream) return "";

  return [
    stream.pix_fmt,
    stream.color_primaries,
    stream.color_transfer,
    stream.color_space,
    stream.color_range,
  ]
    .filter(Boolean)
    .join(" / ");
}

async function captureFramesWithFfmpeg(video) {
  if (!sourceFilePath || !window.deskpetAPI?.extractFrames) return null;

  const duration = Math.min(video.duration || 8, 8);
  const probe = window.deskpetAPI.inspectVideo
    ? await window.deskpetAPI.inspectVideo(sourceFilePath)
    : null;
  const colorInfo = probe?.ok ? summarizeVideoColorInfo(probe) : "";

  setState(processState, colorInfo ? `Extracting frames with ffmpeg / ${colorInfo}` : "Extracting frames with ffmpeg");

  const result = await window.deskpetAPI.extractFrames({
    filePath: sourceFilePath,
    fps: 6,
    maxWidth: 1280,
    duration,
  });

  if (!result?.ok || !result.frames?.length) return null;

  const extractedFrames = await Promise.all(result.frames.map(loadImageToCanvas));
  return { frames: extractedFrames, colorInfo };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function getChromaSettings() {
  return {
    tolerance: Number(keyTolerance.value),
    colorMatch: Number(colorMatchRange.value) / 100,
    shadowLift: Number(shadowLiftRange.value) / 100,
  };
}

function adjustToneValue(value, exposure, shadowLift) {
  let normalized = clamp((value / 255) * exposure, 0, 1);
  if (shadowLift > 0) {
    const shadowWeight = (1 - normalized) * (1 - normalized);
    normalized = clamp(normalized + shadowLift * 0.45 * shadowWeight, 0, 1);
  }
  return Math.round(normalized * 255);
}

function applyToneAdjustment(data, index, exposure, shadowLift) {
  if (exposure === 1 && shadowLift === 0) return;
  data[index] = adjustToneValue(data[index], exposure, shadowLift);
  data[index + 1] = adjustToneValue(data[index + 1], exposure, shadowLift);
  data[index + 2] = adjustToneValue(data[index + 2], exposure, shadowLift);
}

function applyFrameExposure(frameCanvas) {
  const output = document.createElement("canvas");
  output.width = frameCanvas.width;
  output.height = frameCanvas.height;
  const outputCtx = output.getContext("2d", { alpha: true });
  outputCtx.drawImage(frameCanvas, 0, 0);

  const imageData = outputCtx.getImageData(0, 0, output.width, output.height);
  const data = imageData.data;
  const { colorMatch, shadowLift } = getChromaSettings();

  for (let index = 0; index < data.length; index += 4) {
    applyToneAdjustment(data, index, colorMatch, shadowLift);
  }

  outputCtx.putImageData(imageData, 0, 0);
  return output;
}

function applyGreenScreenKey(frameCanvas) {
  const output = document.createElement("canvas");
  output.width = frameCanvas.width;
  output.height = frameCanvas.height;
  const outputCtx = output.getContext("2d", { alpha: true });
  outputCtx.drawImage(frameCanvas, 0, 0);

  const imageData = outputCtx.getImageData(0, 0, output.width, output.height);
  const data = imageData.data;
  const { tolerance } = getChromaSettings();

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const strongestNonGreen = Math.max(red, blue);
    const greenDominance = green - strongestNonGreen;
    const isGreenScreen = green > 70 && greenDominance >= tolerance;

    if (isGreenScreen) {
      data[index + 3] = 0;
      continue;
    }

    data[index + 3] = 255;
  }

  outputCtx.putImageData(imageData, 0, 0);
  return output;
}

function median(values) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function transformFrame(frameCanvas, transform) {
  const output = document.createElement("canvas");
  output.width = frameCanvas.width;
  output.height = frameCanvas.height;
  const outputCtx = output.getContext("2d", { alpha: true });
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = "high";
  const originX = transform.originX ?? frameCanvas.width / 2;
  const originY = transform.originY ?? frameCanvas.height / 2;

  outputCtx.translate(transform.translateX || 0, transform.translateY || 0);
  outputCtx.translate(originX, originY);
  outputCtx.rotate(transform.rotation || 0);
  outputCtx.translate(-originX, -originY);
  outputCtx.drawImage(frameCanvas, 0, 0);
  return output;
}

function getAlphaAnchor(frameCanvas) {
  const frameCtx = frameCanvas.getContext("2d", { alpha: true });
  const { width, height } = frameCanvas;
  const data = frameCtx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 80) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0) return null;

  const bottomStart = minY + (maxY - minY) * 0.72;
  let sumX = 0;
  let weight = 0;

  for (let y = Math.floor(bottomStart); y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 80) continue;
      sumX += x * alpha;
      weight += alpha;
    }
  }

  return {
    x: weight ? sumX / weight : (minX + maxX) / 2,
    y: maxY,
  };
}

function applyAutoAlignment(inputFrames) {
  if (!autoAlign.checked || inputFrames.length < 2) return inputFrames;

  const anchors = inputFrames.map(getAlphaAnchor);
  const validAnchors = anchors.filter(Boolean);
  if (validAnchors.length < 2) return inputFrames;

  const targetX = median(validAnchors.map((anchor) => anchor.x));
  const targetY = median(validAnchors.map((anchor) => anchor.y));

  return inputFrames.map((frame, index) => {
    const anchor = anchors[index];
    if (!anchor) return frame;

    return transformFrame(frame, {
      translateX: targetX - anchor.x,
      translateY: targetY - anchor.y,
    });
  });
}

function applyTrackedPointAlignment(inputFrames) {
  const validPoints = trackedPoints.filter(Boolean);
  if (validPoints.length < 2) return inputFrames;

  const targetX = median(validPoints.map((point) => point.x));
  const targetY = median(validPoints.map((point) => point.y));

  return inputFrames.map((frame, index) => {
    const point = trackedPoints[index];
    if (!point) return frame;

    return transformFrame(frame, {
      translateX: targetX - point.x,
      translateY: targetY - point.y,
    });
  });
}

function getGroundTargetY() {
  const values = [...groundLines.values()].map((line) => (line.a.y + line.b.y) / 2);
  return median(values);
}

function getInterpolatedGroundTransform(index) {
  if (!groundLines.size) return null;

  const radius = Number(keyframeRadiusRange.value);
  const targetY = getGroundTargetY();
  let totalWeight = 0;
  let rotation = 0;
  let translateY = 0;
  let originX = 0;
  let originY = 0;

  for (const [keyIndex, line] of groundLines.entries()) {
    const distance = Math.abs(index - keyIndex);
    if (radius === 0 && distance !== 0) continue;
    if (radius > 0 && distance > radius) continue;

    const weight = radius === 0 ? 1 : 1 - distance / (radius + 1);
    const midX = (line.a.x + line.b.x) / 2;
    const midY = (line.a.y + line.b.y) / 2;
    const angle = Math.atan2(line.b.y - line.a.y, line.b.x - line.a.x);

    totalWeight += weight;
    rotation += -angle * weight;
    translateY += (targetY - midY) * weight;
    originX += midX * weight;
    originY += midY * weight;
  }

  if (!totalWeight) return null;

  return {
    rotation: rotation / totalWeight,
    translateY: translateY / totalWeight,
    originX: originX / totalWeight,
    originY: originY / totalWeight,
  };
}

function applyGroundLineCorrections(inputFrames) {
  return inputFrames.map((frame, index) => {
    const transform = getInterpolatedGroundTransform(index);
    return transform ? transformFrame(frame, transform) : frame;
  });
}

function getForegroundColorDelta(rawFrame, keyedFrame) {
  const width = Math.min(rawFrame.width, keyedFrame.width);
  const height = Math.min(rawFrame.height, keyedFrame.height);
  const rawCtx = rawFrame.getContext("2d", { alpha: true });
  const keyedCtx = keyedFrame.getContext("2d", { alpha: true });
  const rawData = rawCtx.getImageData(0, 0, width, height).data;
  const keyedData = keyedCtx.getImageData(0, 0, width, height).data;
  let totalDelta = 0;
  let count = 0;

  for (let index = 0; index < keyedData.length; index += 4) {
    if (keyedData[index + 3] === 0) continue;
    totalDelta += Math.abs(rawData[index] - keyedData[index]);
    totalDelta += Math.abs(rawData[index + 1] - keyedData[index + 1]);
    totalDelta += Math.abs(rawData[index + 2] - keyedData[index + 2]);
    count += 3;
  }

  return count === 0 ? 0 : totalDelta / count;
}

function updateCompareFrames() {
  if (!rawFrames.length) return 0;

  const boundedIndex = Math.min(editFrameIndex, rawFrames.length - 1);
  const rawFrame = rawFrames[boundedIndex];
  const keyedSource = applyGreenScreenKey(rawFrame);
  const trackedAlignedFrames = applyTrackedPointAlignment(rawFrames.map((frame) => applyGreenScreenKey(frame)));
  const autoAlignedFrames = applyAutoAlignment(trackedAlignedFrames);
  const correctedFrames = applyGroundLineCorrections(autoAlignedFrames);
  const keyedFrame = correctedFrames[boundedIndex] || keyedSource;
  drawCanvasFit(rawCompareCanvas, rawCompareCtx, rawFrame);
  compareLayout = drawCanvasFit(keyedCompareCanvas, keyedCompareCtx, keyedFrame);
  drawGroundLineOverlay();
  return getForegroundColorDelta(rawFrame, keyedFrame);
}

function buildLoopFrames(inputFrames) {
  if (!pingPongLoop.checked || inputFrames.length < 3) return inputFrames;
  return inputFrames.concat(inputFrames.slice(1, -1).reverse());
}

function buildProcessedFrames() {
  const keyedFrames = rawFrames.map((frame) => applyGreenScreenKey(frame));
  const trackedFrames = applyTrackedPointAlignment(keyedFrames);
  const alignedFrames = applyAutoAlignment(trackedFrames);
  return buildLoopFrames(applyGroundLineCorrections(alignedFrames));
}

function syncFrameEditor() {
  const hasFrames = rawFrames.length > 0;
  frameScrubber.disabled = !hasFrames;
  trackPointBtn.disabled = !hasFrames;
  clearGroundLineBtn.disabled = !hasFrames || !groundLines.has(editFrameIndex);
  frameScrubber.max = hasFrames ? String(rawFrames.length - 1) : "0";
  frameScrubber.value = String(Math.min(editFrameIndex, Math.max(0, rawFrames.length - 1)));

  if (!hasFrames) {
    frameEditState.textContent = "Process a video to align frames and height";
    return;
  }

  const lineState = trackingPointMode
    ? "Click a stable body point for OpenCV tracking"
    : groundLines.has(editFrameIndex)
      ? "Ground line set"
      : "Click two ground points on the keyed frame";
  const pendingState = pendingGroundPoint ? ", waiting for the second point" : "";
  frameEditState.textContent = `Frame ${editFrameIndex + 1}/${rawFrames.length}: ${lineState}${pendingState}, influence radius ${keyframeRadiusRange.value} frames`;
}

function drawGroundLineOverlay() {
  if (!compareLayout) return;

  const line = groundLines.get(editFrameIndex);
  keyedCompareCtx.save();
  keyedCompareCtx.lineWidth = 3;
  keyedCompareCtx.strokeStyle = "#d22f27";
  keyedCompareCtx.fillStyle = "#ffffff";

  function toCanvasPoint(point) {
    return {
      x: compareLayout.x + (point.x / compareLayout.sourceWidth) * compareLayout.width,
      y: compareLayout.y + (point.y / compareLayout.sourceHeight) * compareLayout.height,
    };
  }

  function drawPoint(point) {
    keyedCompareCtx.beginPath();
    keyedCompareCtx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    keyedCompareCtx.fill();
    keyedCompareCtx.stroke();
  }

  if (line) {
    const a = toCanvasPoint(line.a);
    const b = toCanvasPoint(line.b);
    keyedCompareCtx.beginPath();
    keyedCompareCtx.moveTo(a.x, a.y);
    keyedCompareCtx.lineTo(b.x, b.y);
    keyedCompareCtx.stroke();
    drawPoint(a);
    drawPoint(b);
  } else if (pendingGroundPoint) {
    drawPoint(toCanvasPoint(pendingGroundPoint));
  }

  keyedCompareCtx.restore();
}

function canvasEventToFramePoint(event) {
  if (!compareLayout) return null;

  const rect = keyedCompareCanvas.getBoundingClientRect();
  const canvasX = ((event.clientX - rect.left) / rect.width) * keyedCompareCanvas.width;
  const canvasY = ((event.clientY - rect.top) / rect.height) * keyedCompareCanvas.height;

  if (
    canvasX < compareLayout.x ||
    canvasX > compareLayout.x + compareLayout.width ||
    canvasY < compareLayout.y ||
    canvasY > compareLayout.y + compareLayout.height
  ) {
    return null;
  }

  return {
    x: ((canvasX - compareLayout.x) / compareLayout.width) * compareLayout.sourceWidth,
    y: ((canvasY - compareLayout.y) / compareLayout.height) * compareLayout.sourceHeight,
  };
}

function setGroundPoint(event) {
  if (!rawFrames.length) return;
  const point = canvasEventToFramePoint(event);
  if (!point) return;

  if (trackingPointMode) {
    trackBodyPoint(point);
    return;
  }

  if (!pendingGroundPoint) {
    pendingGroundPoint = point;
    syncFrameEditor();
    updateCompareFrames();
    return;
  }

  groundLines.set(editFrameIndex, { a: pendingGroundPoint, b: point });
  pendingGroundPoint = null;
  rebuildKeyedFrames();
}

async function trackBodyPoint(point) {
  if (!frames.length || !window.deskpetAPI?.trackPoint) return;

  trackingPointMode = false;
  trackPointBtn.disabled = true;
  setState(processState, "Tracking body point with OpenCV...");

  const keyedFrames = rawFrames.map((frame) => applyGreenScreenKey(frame));
  const result = await window.deskpetAPI.trackPoint({
    frames: keyedFrames.map(frameToDataUrl),
    startIndex: editFrameIndex,
    point,
  });

  if (result?.ok && Array.isArray(result.points)) {
    trackedPoints = result.points.map((trackedPoint) => {
      if (!trackedPoint) return null;
      return { x: trackedPoint[0], y: trackedPoint[1] };
    });
  }

  trackPointBtn.disabled = false;
  rebuildKeyedFrames();
}

function rebuildKeyedFrames() {
  if (!capturedFrames.length) return;
  rawFrames = capturedFrames.map((frame) => applyFrameExposure(frame));
  frames = buildProcessedFrames();
  launchPetBtn.disabled = false;
  const delta = updateCompareFrames();
  syncFrameEditor();
  setState(
    processState,
    `${frames.length} preview frames / exposure ${colorMatchRange.value}% / shadow lift ${shadowLiftRange.value}% / RGB delta ${delta.toFixed(2)}`,
  );
  updateAssetCard();
  startPreview();
}

function frameToDataUrl(frame) {
  return frame.toDataURL("image/png");
}

function getPetPayload() {
  return {
    version: 1,
    kind: "deskpet-animation",
    createdAt: new Date().toISOString(),
    frames: frames.map(frameToDataUrl),
    fps: Number(speedRange.value),
    scale: Number(sizeRange.value) / 100,
    width: canvas.width,
    height: canvas.height,
  };
}

async function savePetPackage() {
  if (!frames.length) return;

  const payload = getPetPayload();
  if (window.deskpetAPI?.savePetPackage) {
    const result = await window.deskpetAPI.savePetPackage(payload);
    if (result?.ok) {
      assetMeta.textContent = `Saved: ${result.filePath}`;
      await loadSavedPackages();
    }
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "deskpet-animation.deskpet.json";
  link.click();
  URL.revokeObjectURL(url);
}

function createSavedPackageCard(item) {
  const card = document.createElement("section");
  card.className = "asset-card";

  const thumb = document.createElement("canvas");
  thumb.width = 160;
  thumb.height = 110;
  const thumbCtx = thumb.getContext("2d", { alpha: true });

  if (item.thumbnail) {
    loadImageToCanvas(item.thumbnail).then((image) => drawCanvasFit(thumb, thumbCtx, image));
  }

  const body = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "package-title";
  title.title = "Double-click to rename";
  title.textContent = item.name;
  title.addEventListener("click", (event) => {
    if (event.detail >= 2) {
      startPackageRename(title, item);
    }
  });
  title.addEventListener("dblclick", (event) => {
    event.preventDefault();
    startPackageRename(title, item);
  });
  const meta = document.createElement("p");
  meta.textContent = `${item.frames} frames / ${item.fps} fps`;
  body.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "asset-actions";
  const launchButton = document.createElement("button");
  launchButton.className = "mini-action";
  launchButton.type = "button";
  launchButton.textContent = "Send to Desktop";
  launchButton.addEventListener("click", () => {
    window.deskpetAPI?.launchPet(item.payload);
  });
  actions.append(launchButton);

  card.append(thumb, body, actions);
  return card;
}

function getPackageDisplayBaseName(fileName) {
  return String(fileName || "").replace(/\.deskpet\.json$/i, "");
}

function startPackageRename(titleElement, item) {
  if (!window.deskpetAPI?.renamePetPackage) return;
  if (!titleElement.isConnected || titleElement.tagName !== "H3") return;

  const input = document.createElement("input");
  input.className = "package-name-input";
  input.type = "text";
  input.value = getPackageDisplayBaseName(item.name);
  input.setAttribute("aria-label", "Package name");

  titleElement.replaceWith(input);
  input.focus();
  input.select();

  let isFinishing = false;

  async function finishRename(shouldSave) {
    if (isFinishing) return;
    isFinishing = true;

    if (!shouldSave) {
      input.replaceWith(titleElement);
      return;
    }

    const result = await window.deskpetAPI.renamePetPackage({
      filePath: item.filePath,
      name: input.value,
    });

    if (!result?.ok) {
      input.classList.add("has-error");
      input.title = result?.error || "Rename failed";
      isFinishing = false;
      return;
    }

    await loadSavedPackages();
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishRename(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishRename(false);
    }
  });

  input.addEventListener("blur", () => {
    finishRename(true);
  });
}

async function loadSavedPackages() {
  if (!window.deskpetAPI?.listPetPackages) {
    savedPackageState.textContent = "Unavailable";
    return;
  }

  const result = await window.deskpetAPI.listPetPackages();
  savedPackageList.replaceChildren();

  if (!result?.ok || !result.packages.length) {
    savedPackageState.textContent = "None";
    return;
  }

  for (const item of result.packages) {
    savedPackageList.append(createSavedPackageCard(item));
  }

  savedPackageState.textContent = `${result.packages.length} saved`;
}

async function launchDesktopPet() {
  if (!frames.length) return;

  const payload = getPetPayload();
  if (window.deskpetAPI?.launchPet) {
    await window.deskpetAPI.launchPet(payload);
    return;
  }

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "deskpet-animation.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function processVideo() {
  if (!sourceVideo.src) return;

  processBtn.disabled = true;
  setState(processState, "Processing");
  previewEmpty.textContent = "Extracting frames and keying the green screen...";
  previewEmpty.classList.remove("is-hidden");
  window.clearInterval(animationTimer);

  if (Number.isNaN(sourceVideo.duration) || !sourceVideo.duration) {
    await new Promise((resolve) => sourceVideo.addEventListener("loadedmetadata", resolve, { once: true }));
  }

  sourceVideo.pause();
  let nextFrames = [];
  let colorInfo = "";
  let captureMode = "Canvas";

  try {
    const ffmpegResult = await captureFramesWithFfmpeg(sourceVideo);
    if (ffmpegResult) {
      nextFrames = ffmpegResult.frames;
      colorInfo = ffmpegResult.colorInfo;
      captureMode = "ffmpeg";
    }
  } catch (error) {
    console.warn("ffmpeg extraction failed, falling back to canvas", error);
  }

  if (!nextFrames.length) {
    const duration = Math.min(sourceVideo.duration, 8);
    const count = Math.min(36, Math.max(12, Math.floor(duration * 6)));
    const start = sourceVideo.duration > 1 ? 0.15 : 0;
    const end = Math.max(start, duration - 0.15);

    for (let index = 0; index < count; index += 1) {
      const progress = count === 1 ? 0 : index / (count - 1);
      const time = start + (end - start) * progress;
      const rawFrame = await captureFrame(sourceVideo, time);
      nextFrames.push(rawFrame);
    }
  }

  capturedFrames = nextFrames;
  rawFrames = capturedFrames.map((frame) => applyFrameExposure(frame));
  editFrameIndex = 0;
  pendingGroundPoint = null;
  frames = buildProcessedFrames();
  previewEmpty.classList.add("is-hidden");
  const delta = updateCompareFrames();
  syncFrameEditor();
  setState(
    processState,
    `${frames.length} frames / ${captureMode} / exposure ${colorMatchRange.value}% / shadow lift ${shadowLiftRange.value}% / RGB delta ${delta.toFixed(2)}${colorInfo ? ` / ${colorInfo}` : ""}`,
  );
  processBtn.disabled = false;
  launchPetBtn.disabled = false;
  updateAssetCard();
  startPreview();
}

videoInput.addEventListener("change", (event) => {
  loadFile(event.target.files[0]);
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  loadFile(event.dataTransfer.files[0]);
});

processBtn.addEventListener("click", processVideo);
launchPetBtn.addEventListener("click", launchDesktopPet);
savePackageBtn.addEventListener("click", savePetPackage);
launchPackageBtn.addEventListener("click", launchDesktopPet);
sizeRange.addEventListener("input", () => {
  previewScale = Number(sizeRange.value) / 100;
  drawFrame(frames[frameIndex]);
});

speedRange.addEventListener("input", startPreview);

frameScrubber.addEventListener("input", () => {
  editFrameIndex = Number(frameScrubber.value);
  pendingGroundPoint = null;
  syncFrameEditor();
  updateCompareFrames();
});

keyedCompareCanvas.addEventListener("click", setGroundPoint);

trackPointBtn.addEventListener("click", () => {
  trackingPointMode = true;
  pendingGroundPoint = null;
  syncFrameEditor();
  updateCompareFrames();
});

clearGroundLineBtn.addEventListener("click", () => {
  groundLines.delete(editFrameIndex);
  pendingGroundPoint = null;
  rebuildKeyedFrames();
});

for (const input of [
  keyTolerance,
  colorMatchRange,
  shadowLiftRange,
  keyframeRadiusRange,
  autoAlign,
  pingPongLoop,
]) {
  input.addEventListener("input", rebuildKeyedFrames);
}

edgeMode.addEventListener("change", () => {
  screenEdge.classList.toggle("free-mode", !edgeMode.checked);
});

loadSavedPackages();
