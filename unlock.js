const unlockBtn = document.querySelector("#unlockBtn");
let dragState = null;

unlockBtn.addEventListener("click", () => {
  if (dragState?.moved) return;
  window.deskpetAPI?.setPetLocked(false);
});

unlockBtn.addEventListener("pointerdown", (event) => {
  dragState = {
    pointerId: event.pointerId,
    lastX: event.screenX,
    lastY: event.screenY,
    startX: event.screenX,
    startY: event.screenY,
    moved: false,
  };
  unlockBtn.setPointerCapture(event.pointerId);
});

unlockBtn.addEventListener("pointermove", async (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const dx = event.screenX - dragState.lastX;
  const dy = event.screenY - dragState.lastY;
  const totalMove = Math.hypot(event.screenX - dragState.startX, event.screenY - dragState.startY);
  if (!dragState.moved && totalMove < 4) return;

  dragState.moved = true;
  dragState.lastX = event.screenX;
  dragState.lastY = event.screenY;
  await window.deskpetAPI?.moveUnlockControl({ dx, dy });
});

unlockBtn.addEventListener("pointerup", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  unlockBtn.releasePointerCapture(event.pointerId);
  window.setTimeout(() => {
    dragState = null;
  }, 0);
});
