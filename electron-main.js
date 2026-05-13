const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { execFile } = require("node:child_process");

function loadElectron() {
  return require("electron");
}

const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = loadElectron();

let mainWindow;
let tray;
let isQuitting = false;
const petInstances = new Map();
const packagesDir = path.join(__dirname, "packages");
const unlockWindowSize = { width: 150, height: 96 };
const unlockButtonSize = { width: 74, height: 36 };
const isWindows = process.platform === "win32";

function getResourcePath(...segments) {
  return path.join(app?.isPackaged ? process.resourcesPath : __dirname, ...segments);
}

function getFfmpegCandidates(binaryName) {
  const executable = isWindows ? `${binaryName}.exe` : binaryName;
  const envKey = binaryName === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH";
  return [
    process.env[envKey],
    getResourcePath("bin", executable),
    path.join(__dirname, "bin", executable),
    isWindows ? `C:\\ffmpeg\\bin\\${executable}` : null,
    isWindows ? `C:\\Program Files\\ffmpeg\\bin\\${executable}` : null,
    `/opt/homebrew/bin/${binaryName}`,
    `/usr/local/bin/${binaryName}`,
    `/usr/bin/${binaryName}`,
  ].filter(Boolean);
}

function getPythonCandidates() {
  return [
    process.env.PYTHON_PATH,
    isWindows ? "python.exe" : "python3",
    "python",
  ].filter(Boolean);
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024 * 32 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return "";
}

function dataUrlToBuffer(dataUrl) {
  const [, base64 = ""] = dataUrl.split(",");
  return Buffer.from(base64, "base64");
}

async function writePetPackage(payload, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

function getPackageFileName(payload) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const frameCount = payload.frames?.length || 0;
  return `deskpet-${timestamp}-${frameCount}f.deskpet.json`;
}

function sanitizePackageBaseName(name) {
  return String(name || "")
    .trim()
    .replace(/\.deskpet\.json$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function getAvailablePackagePath(baseName, currentPath = "") {
  let candidateName = `${baseName}.deskpet.json`;
  let candidatePath = path.join(packagesDir, candidateName);
  let suffix = 2;

  while (candidatePath !== currentPath && (await pathExists(candidatePath))) {
    candidateName = `${baseName}-${suffix}.deskpet.json`;
    candidatePath = path.join(packagesDir, candidateName);
    suffix += 1;
  }

  return candidatePath;
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 960,
    minHeight: 720,
    title: "DeskPet MVP",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }

  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

function closeAllPets() {
  const windows = new Set(
    [...petInstances.values()]
      .map((instance) => instance.petWindow)
      .filter((window) => window && !window.isDestroyed()),
  );

  for (const window of windows) {
    window.close();
  }
}

function quitApplication() {
  isQuitting = true;
  app.quit();
}

function installApplicationMenu() {
  const template = [
    {
      label: "DeskPet",
      submenu: [
        {
          label: "Show Main Window",
          accelerator: "CommandOrControl+Shift+D",
          click: showMainWindow,
        },
        {
          label: "Hide Main Window",
          accelerator: "CommandOrControl+H",
          click: hideMainWindow,
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CommandOrControl+Q",
          click: quitApplication,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function installTray() {
  if (tray) return;

  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("🐱");
  tray.setToolTip("DeskPet");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show Main Window",
        click: showMainWindow,
      },
      {
        label: "Hide Main Window",
        click: hideMainWindow,
      },
      { type: "separator" },
      {
        label: "Close All Pets",
        click: closeAllPets,
      },
      { type: "separator" },
      {
        label: "Quit DeskPet",
        click: quitApplication,
      },
    ]),
  );
  tray.on("click", showMainWindow);
}

function keepAboveSystemUi(window) {
  if (!window || window.isDestroyed()) return;
  window.setAlwaysOnTop(true, "screen-saver");
  if (typeof window.setVisibleOnAllWorkspaces === "function") {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
}

function getDefaultControlOffset(petBounds) {
  return {
    x: 0,
    y: Math.max(0, petBounds.height - unlockWindowSize.height),
  };
}

function clampBoundsToDisplay(bounds) {
  const displayBounds = screen.getDisplayMatching(bounds).bounds;
  return {
    ...bounds,
    x: Math.min(
      displayBounds.x + displayBounds.width - bounds.width,
      Math.max(displayBounds.x, bounds.x),
    ),
    y: Math.min(
      displayBounds.y + displayBounds.height - bounds.height,
      Math.max(displayBounds.y, bounds.y),
    ),
  };
}

function createPetWindow(payload) {
  const display = screen.getPrimaryDisplay();
  const windowWidth = 420;
  const windowHeight = 320;
  const offset = petInstances.size * 28;
  const x = Math.round(display.workArea.x + display.workArea.width - windowWidth - 36 - offset);
  const y = Math.round(display.workArea.y + display.workArea.height - windowHeight - 24 - offset);

  const petWindow = new BrowserWindow({
    x,
    y,
    width: windowWidth,
    height: windowHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    title: "DeskPet",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  keepAboveSystemUi(petWindow);
  petWindow.loadFile(path.join(__dirname, "pet.html"));
  const petWebContentsId = petWindow.webContents.id;
  const instance = {
    petWindow,
    unlockWindow: null,
    controlOffset: null,
    cursorTimer: null,
    payload,
  };
  petInstances.set(petWebContentsId, instance);

  petWindow.webContents.once("did-finish-load", () => {
    petWindow.webContents.send("pet:frames", payload);
  });

  petWindow.on("move", () => positionUnlockWindow(instance));
  petWindow.on("resize", () => positionUnlockWindow(instance));

  petWindow.on("closed", () => {
    stopCursorTracking(instance);
    if (instance.unlockWindow && !instance.unlockWindow.isDestroyed()) {
      instance.unlockWindow.close();
    }
    petInstances.delete(petWebContentsId);
  });
}

function createUnlockWindow(instance) {
  const { petWindow } = instance;
  if (!petWindow || petWindow.isDestroyed()) return null;

  if (instance.unlockWindow && !instance.unlockWindow.isDestroyed()) {
    return instance.unlockWindow;
  }

  const petBounds = petWindow.getBounds();
  const offset = instance.controlOffset || getDefaultControlOffset(petBounds);
  const initialBounds = clampBoundsToDisplay({
    x: petBounds.x + offset.x,
    y: petBounds.y + offset.y,
    width: unlockWindowSize.width,
    height: unlockWindowSize.height,
  });
  instance.unlockWindow = new BrowserWindow({
    ...initialBounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    title: "Unlock DeskPet",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  keepAboveSystemUi(instance.unlockWindow);
  instance.unlockWindow.loadFile(path.join(__dirname, "unlock.html"));
  const unlockWebContentsId = instance.unlockWindow.webContents.id;
  petInstances.set(unlockWebContentsId, instance);
  instance.unlockWindow.on("closed", () => {
    petInstances.delete(unlockWebContentsId);
    instance.unlockWindow = null;
  });
  return instance.unlockWindow;
}

function positionUnlockWindow(instance) {
  const { petWindow, unlockWindow } = instance;
  if (!petWindow || petWindow.isDestroyed() || !unlockWindow || unlockWindow.isDestroyed()) return;
  const petBounds = petWindow.getBounds();
  const offset = instance.controlOffset || getDefaultControlOffset(petBounds);
  const nextBounds = clampBoundsToDisplay({
    x: petBounds.x + offset.x,
    y: petBounds.y + offset.y,
    width: unlockWindowSize.width,
    height: unlockWindowSize.height,
  });
  unlockWindow.setBounds(nextBounds);
  instance.controlOffset = {
    x: nextBounds.x - petBounds.x,
    y: nextBounds.y - petBounds.y,
  };
}

function startCursorTracking(instance) {
  if (instance.cursorTimer) return;

  instance.cursorTimer = setInterval(() => {
    const { petWindow } = instance;
    if (!petWindow || petWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    petWindow.webContents.send("cursor:point", {
      screenX: cursor.x,
      screenY: cursor.y,
      localX: cursor.x - bounds.x,
      localY: cursor.y - bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  }, 50);
}

function stopCursorTracking(instance) {
  if (!instance?.cursorTimer) return;
  clearInterval(instance.cursorTimer);
  instance.cursorTimer = null;
}

function getPetInstanceFromEvent(event) {
  return petInstances.get(event.sender.id);
}

app.whenReady().then(() => {
  installApplicationMenu();
  installTray();
  if (process.platform === "darwin") {
    app.dock?.hide();
  }
  createMainWindow();

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("pet:launch", (_event, payload) => {
  createPetWindow(payload);
  return { ok: true };
});

ipcMain.handle("pet:close", (event) => {
  const instance = getPetInstanceFromEvent(event);
  if (instance?.petWindow && !instance.petWindow.isDestroyed()) {
    instance.petWindow.close();
  }
  return { ok: true };
});

ipcMain.handle("pet:setLocked", (event, locked) => {
  const instance = getPetInstanceFromEvent(event);
  if (instance?.petWindow && !instance.petWindow.isDestroyed()) {
    instance.petWindow.setIgnoreMouseEvents(Boolean(locked), { forward: true });
    instance.petWindow.webContents.send("pet:locked", Boolean(locked));
    if (locked) {
      const controlWindow = createUnlockWindow(instance);
      positionUnlockWindow(instance);
      controlWindow?.showInactive();
    } else if (instance.unlockWindow && !instance.unlockWindow.isDestroyed()) {
      instance.unlockWindow.hide();
    }
  }
  return { ok: true };
});

ipcMain.handle("pet:setControlOffset", (event, offset) => {
  const instance = getPetInstanceFromEvent(event);
  if (!instance?.petWindow || instance.petWindow.isDestroyed()) return { ok: false };
  const petBounds = instance.petWindow.getBounds();
  const maxX = Math.max(8, petBounds.width - unlockWindowSize.width - 8);
  const maxY = Math.max(8, petBounds.height - unlockWindowSize.height - 8);
  instance.controlOffset = {
    x: Math.min(maxX, Math.max(0, (Number(offset?.x) || 0) - (unlockWindowSize.width - unlockButtonSize.width) / 2)),
    y: Math.min(maxY, Math.max(0, (Number(offset?.y) || 0) - (unlockWindowSize.height - unlockButtonSize.height) / 2)),
  };
  positionUnlockWindow(instance);
  return { ok: true };
});

ipcMain.handle("pet:moveUnlockControl", (event, delta) => {
  const instance = getPetInstanceFromEvent(event);
  if (!instance?.petWindow || instance.petWindow.isDestroyed()) return { ok: false };
  const petBounds = instance.petWindow.getBounds();
  const offset = instance.controlOffset || getDefaultControlOffset(petBounds);
  instance.controlOffset = {
    x: offset.x + (Number(delta?.dx) || 0),
    y: offset.y + (Number(delta?.dy) || 0),
  };
  positionUnlockWindow(instance);
  return { ok: true };
});

ipcMain.handle("pet:resizeWindow", (event, factor) => {
  const instance = getPetInstanceFromEvent(event);
  if (!instance?.petWindow || instance.petWindow.isDestroyed()) return { ok: false };
  const petWindow = instance.petWindow;
  const bounds = petWindow.getBounds();
  const nextWidth = Math.round(Math.min(900, Math.max(180, bounds.width * Number(factor || 1))));
  const nextHeight = Math.round(Math.min(720, Math.max(140, bounds.height * Number(factor || 1))));
  const nextBounds = clampBoundsToDisplay({
    x: Math.round(bounds.x + (bounds.width - nextWidth) / 2),
    y: Math.round(bounds.y + (bounds.height - nextHeight) / 2),
    width: nextWidth,
    height: nextHeight,
  });
  petWindow.setBounds(nextBounds);
  keepAboveSystemUi(petWindow);
  if (instance.unlockWindow && !instance.unlockWindow.isDestroyed()) {
    keepAboveSystemUi(instance.unlockWindow);
    positionUnlockWindow(instance);
  }
  return { ok: true, bounds: nextBounds };
});

ipcMain.handle("pet:setLookMode", (event, enabled) => {
  const instance = getPetInstanceFromEvent(event);
  if (!instance) return { ok: false };
  if (enabled) {
    startCursorTracking(instance);
  } else {
    stopCursorTracking(instance);
  }
  return { ok: true };
});

ipcMain.handle("pet:savePackage", async (_event, payload) => {
  const filePath = path.join(packagesDir, getPackageFileName(payload));
  await writePetPackage(payload, filePath);
  return { ok: true, filePath };
});

ipcMain.handle("pet:listPackages", async () => {
  await fs.mkdir(packagesDir, { recursive: true });
  const files = (await fs.readdir(packagesDir)).filter((file) => file.endsWith(".deskpet.json"));
  const packages = [];

  for (const file of files) {
    const filePath = path.join(packagesDir, file);
    try {
      const payload = JSON.parse(await fs.readFile(filePath, "utf8"));
      packages.push({
        filePath,
        name: file,
        frames: payload.frames?.length || 0,
        fps: payload.fps || 12,
        thumbnail: payload.frames?.[0] || "",
        payload,
      });
    } catch {
      // Ignore malformed packages.
    }
  }

  return { ok: true, packages };
});

ipcMain.handle("pet:renamePackage", async (_event, payload) => {
  const currentPath = path.resolve(String(payload?.filePath || ""));
  const packageRoot = path.resolve(packagesDir);
  const relativePath = path.relative(packageRoot, currentPath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return { ok: false, error: "Package is outside the packages directory." };
  }

  if (!(await pathExists(currentPath))) {
    return { ok: false, error: "Package file not found." };
  }

  const baseName = sanitizePackageBaseName(payload?.name);
  if (!baseName) {
    return { ok: false, error: "Package name is empty." };
  }

  const nextPath = await getAvailablePackagePath(baseName, currentPath);
  if (nextPath === currentPath) {
    return { ok: true, filePath: currentPath, name: path.basename(currentPath) };
  }

  await fs.rename(currentPath, nextPath);
  return { ok: true, filePath: nextPath, name: path.basename(nextPath) };
});

ipcMain.handle("track:point", async (_event, payload) => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "deskpet-track-"));

  try {
    const framePaths = await Promise.all(
      payload.frames.map(async (frame, index) => {
        const filePath = path.join(outputDir, `frame-${String(index).padStart(3, "0")}.png`);
        await fs.writeFile(filePath, dataUrlToBuffer(frame));
        return filePath;
      }),
    );

    const scriptPath = path.join(__dirname, "scripts", "track_point.py");
    const input = JSON.stringify({
      frames: framePaths,
      startIndex: payload.startIndex,
      point: payload.point,
    });
    let stdout = "";
    let lastError = null;

    for (const pythonPath of getPythonCandidates()) {
      try {
        const result = await new Promise((resolve, reject) => {
          const child = execFile(
            pythonPath,
            [scriptPath],
            { maxBuffer: 1024 * 1024 * 16 },
            (error, stdout, stderr) => {
              if (error) {
                error.stderr = stderr;
                reject(error);
                return;
              }
              resolve({ stdout, stderr });
            },
          );

          child.stdin.end(input);
        });
        stdout = result.stdout;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      return { ok: false, error: "Python with OpenCV was not found. Body-point tracking is unavailable." };
    }

    return { ok: true, ...JSON.parse(stdout) };
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
});

ipcMain.handle("video:inspect", async (_event, filePath) => {
  const ffprobePath = await findFirstExistingPath(getFfmpegCandidates("ffprobe"));
  if (!ffprobePath) {
    return { ok: false, error: "ffprobe not found" };
  }

  const { stdout } = await execFileAsync(ffprobePath, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,pix_fmt,color_space,color_transfer,color_primaries,color_range,width,height,r_frame_rate,duration",
    "-show_entries",
    "stream_side_data",
    "-of",
    "json",
    filePath,
  ]);

  return { ok: true, data: JSON.parse(stdout) };
});

ipcMain.handle("video:extractFrames", async (_event, payload) => {
  const { filePath, fps = 6, maxWidth = 1280, duration = 8 } = payload;
  const ffmpegPath = await findFirstExistingPath(getFfmpegCandidates("ffmpeg"));
  if (!ffmpegPath) {
    return { ok: false, error: "ffmpeg not found" };
  }

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "deskpet-frames-"));
  const pattern = path.join(outputDir, "frame-%03d.png");
  const filter = [
    `fps=${fps}`,
    `scale='min(${maxWidth},iw)':-2:flags=lanczos`,
    "zscale=t=linear:npl=100",
    "format=gbrpf32le",
    "tonemap=tonemap=hable:desat=0",
    "zscale=p=bt709:t=bt709:m=bt709:r=tv",
    "format=rgba",
  ].join(",");

  try {
    await execFileAsync(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-t",
      String(duration),
      "-i",
      filePath,
      "-vf",
      filter,
      "-frames:v",
      String(Math.max(1, Math.ceil(duration * fps))),
      pattern,
    ]);
  } catch (error) {
    await execFileAsync(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-t",
      String(duration),
      "-i",
      filePath,
      "-vf",
      `fps=${fps},scale='min(${maxWidth},iw)':-2:flags=lanczos,format=rgba`,
      "-frames:v",
      String(Math.max(1, Math.ceil(duration * fps))),
      pattern,
    ]);
  }

  const files = (await fs.readdir(outputDir)).filter((file) => file.endsWith(".png")).sort();
  const frames = await Promise.all(
    files.map(async (file) => {
      const buffer = await fs.readFile(path.join(outputDir, file));
      return `data:image/png;base64,${buffer.toString("base64")}`;
    }),
  );

  await fs.rm(outputDir, { recursive: true, force: true });
  return { ok: true, frames };
});
