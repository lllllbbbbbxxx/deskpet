# DeskPet MVP

DeskPet turns a real green-screen cat video into a transparent desktop pet. It is an Electron MVP for creating, saving, and launching small animated cat companions on your desktop.

<img width="900" height="416" alt="demo" src="https://github.com/user-attachments/assets/2e3e3ef0-ed4c-4621-9f0f-5479004f9171" />

> Important: this MVP works best with green-screen cat videos. If you only have a normal cat video, prepare it in CapCut first, then upload the green-screen version to DeskPet.

## Features

- Upload a short green-screen cat video.
- Extract frames with ffmpeg to avoid HDR/browser canvas color shifts.
- Remove the green background and preview transparent frames.
- Adjust green tolerance, frame exposure, and shadow lift.
- Align frames manually with ground-line keyframes or track one body point with OpenCV.
- Save animations as `.deskpet.json` packages.
- Launch one or more transparent always-on-top desktop pet windows.
- Lock a pet so it does not block normal clicks, then unlock it from a hover control.
- Access the app from the macOS menu bar.
- Build macOS `.dmg` and Windows `.exe` installers.

## Install and Run

There are two ways to use DeskPet.

### Option 1: Download an Installer

This is the recommended path for regular users.

1. Open the GitHub Releases page for this project.
2. Download the installer for your platform:
   - macOS Apple Silicon: `DeskPet-0.1.1-arm64.dmg`
   - Windows: `DeskPet Setup 0.1.1.exe`
3. Install and open DeskPet.

On macOS, the app is currently unsigned. If macOS blocks the first launch, open **System Settings -> Privacy & Security**, find DeskPet, and click **Open Anyway**.

### Option 2: Run from Source

This is the recommended path for developers, or for users who want to run the project before downloading an installer.

You need:

- Node.js 18+
- npm
- ffmpeg and ffprobe
- Optional: Python + OpenCV, only for body-point tracking

You do not need to install Electron manually. It will be installed by `npm install`.

#### Step 1: Install Node.js and npm

Node.js runs the development tools for the app. npm is installed together with Node.js.

For beginners, the easiest option is:

1. Go to <https://nodejs.org/>.
2. Download the LTS version.
3. Install it.
4. Open Terminal and check:

```bash
node -v
npm -v
```

If both commands print version numbers, Node.js and npm are installed.

On macOS, you can also install them with Homebrew:

```bash
brew install node
```

#### Step 2: Install ffmpeg and ffprobe

DeskPet uses ffmpeg/ffprobe to extract video frames with more reliable color handling.

On macOS with Homebrew:

```bash
brew install ffmpeg
```

Check that it worked:

```bash
ffmpeg -version
ffprobe -version
```

On Windows, install ffmpeg from <https://ffmpeg.org/download.html>, or use a package manager such as Chocolatey:

```powershell
choco install ffmpeg
```

After installing on Windows, open a new terminal and check:

```powershell
ffmpeg -version
ffprobe -version
```

If DeskPet cannot find ffmpeg automatically, set these paths before launching:

```bash
FFMPEG_PATH=/path/to/ffmpeg
FFPROBE_PATH=/path/to/ffprobe
```

Common macOS paths:

```bash
/opt/homebrew/bin/ffmpeg
/opt/homebrew/bin/ffprobe
```

Common Windows paths:

```text
C:\ffmpeg\bin\ffmpeg.exe
C:\ffmpeg\bin\ffprobe.exe
C:\Program Files\ffmpeg\bin\ffmpeg.exe
C:\Program Files\ffmpeg\bin\ffprobe.exe
```

#### Step 3: Open the Project Directory

"From the project directory" means your terminal is inside the DeskPet folder.

For example:

```bash
cd path/to/deskpet
```

If you downloaded the project to `Downloads`, it may look like:

```bash
cd ~/Downloads/deskpet
```

#### Step 4: Install and Launch

Install project dependencies:

```bash
npm install
```

Start DeskPet:

```bash
npm start
```

On macOS, you can also double-click:

```text
Launch DeskPet.command
```

The launcher uses the local Electron install when available. If dependencies are missing, it runs `npm install` before starting the app.

#### Optional: OpenCV Tracking

OpenCV is only used by the optional **Track Body Point** feature for stabilizing/alignment. It is not required for green-screen removal, saved packages, desktop pets, or the lightweight mouse-follow behavior.

If you want OpenCV tracking:

```bash
pip install opencv-python
```

If DeskPet needs a specific Python executable, set:

```bash
PYTHON_PATH=/path/to/python
```

## Quick Test

After launching the app, try the included sample video first:

```text
samples/cat_Ares.MOV
```

This lets you test the full flow without preparing your own video.

## Usage

1. Upload a 3-8 second green-screen cat video.
2. Click **Process Video**.
3. Tune green tolerance and exposure settings if needed.
4. Optionally align the animation with ground-line keyframes or OpenCV body-point tracking.
5. Click **Save Package** or **Send to Desktop**.
6. In the desktop pet window, use **Look** for a lightweight full-body mouse-follow effect.
7. Use **Lock** to make the pet click-through. Move the mouse near the pet to reveal **Unlock**.

Saved packages are written to `packages/` by default. This folder is ignored by Git because package files can become large.

## Prepare Your Own Cat Video with CapCut

DeskPet needs a green-screen video.

1. Open CapCut.
2. Import a short cat video.
3. Use Background Removal to cut out the cat.
4. Add a pure green background: `#00FF00`.
5. Export a 3-8 second video.
6. Upload it to DeskPet.

Tips:

- Keep the full cat visible in the frame.
- Use a clean background before cutting out the cat.
- Avoid shaky footage when possible.
- Use short motion that can loop naturally.

Step screenshots:

| 1 | 2 | 3 | 4 |
|---|---|---|---|
| <img width="190" alt="1" src="https://github.com/user-attachments/assets/8f755294-fd59-4365-87e0-58905e988877" /> | <img width="190" alt="2" src="https://github.com/user-attachments/assets/623cce97-991c-45d8-8f32-f6d9309bf908" /> | <img width="190" alt="3" src="https://github.com/user-attachments/assets/7978de50-680d-495b-bde7-61505c446134" /> | <img width="190" alt="4" src="https://github.com/user-attachments/assets/aa473f0d-f4a1-4d6d-a097-19d5111d4402" /> |
| 5 | 6 | 7 | 8 |
| <img width="190" alt="5" src="https://github.com/user-attachments/assets/8b563aef-45fa-44ac-bc56-c70ac476ca78" /> | <img width="190" alt="6" src="https://github.com/user-attachments/assets/db845fc3-3499-4f7a-93eb-59f190dc084d" /> | <img width="190" alt="7" src="https://github.com/user-attachments/assets/023a4c00-67c4-47a9-90a9-a5ef361ca557" /> | <img width="190" alt="8" src="https://github.com/user-attachments/assets/21c5e311-d2ef-4f9d-a90d-3dac7791679a" /> |

## Example Green-Screen Videos
Example source videos are available in `samples/`:

- [`samples/cat_Ares.MOV`](samples/cat_Ares.MOV)
- [`samples/cat_Zobo.MOV`](samples/cat_Zobo.MOV)

These are included so you can test DeskPet before recording your own cat video.

## Package Installers

Install dependencies first:

```bash
npm install
```

Create an unpacked `.app` for local testing:

```bash
npm run pack
```

Create a macOS `.dmg`:

```bash
npm run dist:mac
```

Create a Windows `.exe` installer on Windows:

```bash
npm run dist:win
```

The build output is written to `release/`.

For GitHub releases, use the included workflow:

```text
.github/workflows/build-installers.yml
```

It builds:

- macOS artifact: `release/*.dmg`
- Windows artifact: `release/*.exe`

The packaged app can run without ffmpeg, but frame extraction may fall back to browser canvas capture. For best color handling, install ffmpeg on the user's machine or bundle ffmpeg/ffprobe into a `bin/` folder before building.

## Project Structure

```text
.
├── electron-main.js       Electron main process, windows, tray menu, ffmpeg, package IO
├── preload.js             Safe IPC bridge exposed to renderer windows
├── index.html             Main processing UI
├── script.js              Video processing, keying, preview, package creation
├── styles.css             Main UI styles
├── pet.html               Desktop pet window
├── pet.js                 Pet animation, locking, resizing, mouse-follow behavior
├── pet.css                Desktop pet styles
├── assets/                README screenshots, GIFs, and CapCut tutorial images
├── samples/               Green-screen sample videos
├── unlock.html            Click-through unlock control window
├── unlock.js              Unlock control behavior
├── unlock.css             Unlock control styles
├── scripts/
│   └── track_point.py     Optional OpenCV point tracker
└── matting-api.md         Notes for future matting API integration
```

## Development Checks

```bash
npm run check
```

This runs JavaScript syntax checks for the Electron main process and renderer scripts.

## Notes

- The MVP is optimized for green-screen source videos, not arbitrary real backgrounds.
- Always-on-top behavior can vary across macOS versions and desktop settings.
- macOS installers are unsigned unless you add an Apple Developer ID certificate.
- Windows installers are unsigned unless you add a code-signing certificate.
