const canvas = document.querySelector("#desktopPetCanvas");
const closePetBtn = document.querySelector("#closePetBtn");
const lockPetBtn = document.querySelector("#lockPetBtn");
const lookPetBtn = document.querySelector("#lookPetBtn");
const shrinkPetBtn = document.querySelector("#shrinkPetBtn");
const growPetBtn = document.querySelector("#growPetBtn");
const petStage = document.querySelector("#petStage");
const ctx = canvas.getContext("2d", { alpha: true });

let frames = [];
let frameIndex = 0;
let frameTimer = 0;
let fps = 12;
let scale = 1;
let locked = false;
let lookMode = false;
let cursorInfluence = { x: 0, y: 0 };
let lockButtonDrag = null;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawFrame() {
  clearCanvas();
  const image = frames[frameIndex];
  if (!image) return;

  const maxHeight = canvas.height * 0.9 * scale;
  const maxWidth = canvas.width * 0.95 * scale;
  const ratio = image.width / image.height;
  let targetHeight = maxHeight;
  let targetWidth = targetHeight * ratio;

  if (targetWidth > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = targetWidth / ratio;
  }

  const x = (canvas.width - targetWidth) / 2;
  const y = canvas.height - targetHeight;

  if (lookMode) {
    const lean = cursorInfluence.x;
    const lift = cursorInfluence.y;
    const pivotX = x + targetWidth * 0.58;
    const pivotY = y + targetHeight * 0.42;

    ctx.save();
    ctx.translate(lean * 10, lift * 5);
    ctx.translate(pivotX, pivotY);
    ctx.rotate(lean * 0.07);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(image, x, y, targetWidth, targetHeight);
    ctx.restore();
    return;
  }

  ctx.drawImage(image, x, y, targetWidth, targetHeight);
}

function startAnimation() {
  window.clearInterval(frameTimer);
  if (!frames.length) return;

  frameIndex = 0;
  drawFrame();
  frameTimer = window.setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    drawFrame();
  }, 1000 / fps);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function loadPayload(payload) {
  window.clearInterval(frameTimer);
  clearCanvas();

  fps = Math.max(1, Number(payload.fps) || 12);
  scale = Math.max(0.4, Math.min(1.6, Number(payload.scale) || 1));
  frames = await Promise.all((payload.frames || []).map(loadImage));
  startAnimation();
}

window.deskpetAPI?.onPetFrames(loadPayload);
window.deskpetAPI?.onPetLocked((nextLocked) => {
  locked = nextLocked;
  petStage.classList.toggle("is-locked", locked);
});
window.deskpetAPI?.onCursorPoint((point) => {
  if (!lookMode) return;
  const centerX = point.width / 2;
  const centerY = point.height / 2;
  cursorInfluence = {
    x: Math.max(-1, Math.min(1, (point.localX - centerX) / centerX)),
    y: Math.max(-1, Math.min(1, (point.localY - centerY) / centerY)),
  };
});

closePetBtn.addEventListener("click", () => {
  window.deskpetAPI?.closePet();
});

shrinkPetBtn.addEventListener("click", () => {
  window.deskpetAPI?.resizePetWindow(0.9);
});

growPetBtn.addEventListener("click", () => {
  window.deskpetAPI?.resizePetWindow(1.1);
});

async function setLocked(nextLocked) {
  locked = nextLocked;
  petStage.classList.toggle("is-locked", locked);
  await window.deskpetAPI?.setPetLocked(locked);
}

lockPetBtn.addEventListener("click", () => {
  if (lockButtonDrag?.moved) return;
  setLocked(true);
});

lockPetBtn.addEventListener("pointerdown", (event) => {
  if (locked) return;
  const rect = lockPetBtn.getBoundingClientRect();
  lockButtonDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    moved: false,
  };
  lockPetBtn.setPointerCapture(event.pointerId);
});

lockPetBtn.addEventListener("pointermove", async (event) => {
  if (!lockButtonDrag || lockButtonDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - lockButtonDrag.startX;
  const dy = event.clientY - lockButtonDrag.startY;
  if (!lockButtonDrag.moved && Math.hypot(dx, dy) < 4) return;

  lockButtonDrag.moved = true;
  const maxX = Math.max(8, window.innerWidth - lockPetBtn.offsetWidth - 8);
  const maxY = Math.max(8, window.innerHeight - lockPetBtn.offsetHeight - 8);
  const x = Math.min(maxX, Math.max(8, event.clientX - lockButtonDrag.offsetX));
  const y = Math.min(maxY, Math.max(8, event.clientY - lockButtonDrag.offsetY));
  lockPetBtn.classList.add("is-positioned");
  lockPetBtn.style.left = `${x}px`;
  lockPetBtn.style.top = `${y}px`;
  await window.deskpetAPI?.setControlOffset({ x, y });
});

lockPetBtn.addEventListener("pointerup", (event) => {
  if (!lockButtonDrag || lockButtonDrag.pointerId !== event.pointerId) return;
  lockPetBtn.releasePointerCapture(event.pointerId);
  window.setTimeout(() => {
    lockButtonDrag = null;
  }, 0);
});

window.addEventListener(
  "wheel",
  (event) => {
    if (locked) return;
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.92 : 1.08;
    window.deskpetAPI?.resizePetWindow(factor);
  },
  { passive: false },
);

lookPetBtn.addEventListener("click", async () => {
  lookMode = !lookMode;
  lookPetBtn.classList.toggle("is-active", lookMode);
  await window.deskpetAPI?.setLookMode(lookMode);
  if (!lookMode) {
    cursorInfluence = { x: 0, y: 0 };
  }
});
