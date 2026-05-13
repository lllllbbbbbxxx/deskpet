const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("deskpetAPI", {
  getFilePath: (file) => webUtils.getPathForFile(file),
  inspectVideo: (filePath) => ipcRenderer.invoke("video:inspect", filePath),
  extractFrames: (payload) => ipcRenderer.invoke("video:extractFrames", payload),
  savePetPackage: (payload) => ipcRenderer.invoke("pet:savePackage", payload),
  listPetPackages: () => ipcRenderer.invoke("pet:listPackages"),
  renamePetPackage: (payload) => ipcRenderer.invoke("pet:renamePackage", payload),
  trackPoint: (payload) => ipcRenderer.invoke("track:point", payload),
  launchPet: (payload) => ipcRenderer.invoke("pet:launch", payload),
  closePet: () => ipcRenderer.invoke("pet:close"),
  setPetLocked: (locked) => ipcRenderer.invoke("pet:setLocked", locked),
  setControlOffset: (offset) => ipcRenderer.invoke("pet:setControlOffset", offset),
  moveUnlockControl: (delta) => ipcRenderer.invoke("pet:moveUnlockControl", delta),
  resizePetWindow: (factor) => ipcRenderer.invoke("pet:resizeWindow", factor),
  setLookMode: (enabled) => ipcRenderer.invoke("pet:setLookMode", enabled),
  onCursorPoint: (callback) => {
    ipcRenderer.removeAllListeners("cursor:point");
    ipcRenderer.on("cursor:point", (_event, point) => callback(point));
  },
  onPetLocked: (callback) => {
    ipcRenderer.removeAllListeners("pet:locked");
    ipcRenderer.on("pet:locked", (_event, locked) => callback(locked));
  },
  onPetFrames: (callback) => {
    ipcRenderer.removeAllListeners("pet:frames");
    ipcRenderer.on("pet:frames", (_event, payload) => callback(payload));
  },
});
