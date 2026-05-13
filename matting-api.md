# Matting and Green-Screen Processing Notes

The current MVP uses green-screen keying instead of full automatic matting. The main replacement point is `applyGreenScreenKey(frameCanvas)` in `script.js`.

For best results, cut out the cat in a professional editor first, export it on a pure green background, and then use this app to convert the green background into transparent animation frames. This is much more stable than trying to segment a cat from a complex real-world background in the browser.

## Green-Screen Asset Guidelines

- Use a pure green background, ideally close to `#00ff00`.
- Avoid green accessories, green spill, green toys, or reflective green light on the cat.
- Keep only light feathering around the edge; avoid complex shadows baked into the green screen.
- Export a short 3-8 second video with the full cat visible.
- If the motion needs to loop, keep the first and last poses similar.

## Current Local Pipeline

```text
Upload green-screen video
-> Extract frames with ffmpeg when available
-> Convert green background to transparent pixels
-> Optional exposure and shadow adjustment
-> Optional frame alignment
-> Optional head-region selection for mouse-follow behavior
-> Save as a .deskpet.json animation package
-> Launch in an Electron transparent desktop pet window
```

To preserve the original cat colors, the MVP only changes alpha during green-screen removal. The cat RGB values are kept as-is unless the exposure or shadow sliders are adjusted.

## Future Matting API Path

If a real background-removal service is added later, keep the frame extraction pipeline and send each frame to a backend service. The backend can call a matting model or API, then return transparent PNG/WebP frames to the frontend.

Recommended pipeline:

```text
Frontend uploads video
-> Frontend or backend extracts frames
-> Backend calls matting API/model
-> Backend returns transparent frame sequence
-> Frontend previews frames
-> App packages frames as a desktop pet animation
```

## Possible Services

- remove.bg: simple to integrate, useful for photo or single-frame validation, but expensive for video frame sequences.
- Clipdrop Remove Background: usually stable for quick MVP validation.
- Bria RMBG, MODNet, Robust Video Matting: better for self-hosting and longer-term cost control.

## Suggested Backend Endpoint

```http
POST /api/matting/frame
Content-Type: multipart/form-data

frame=<png blob>
```

Response:

```json
{
  "ok": true,
  "image": "data:image/png;base64,..."
}
```

## Frontend Replacement Point

Replace this line in `processVideo()`:

```js
frames = buildProcessedFrames();
```

with a matting-backed flow:

```js
frames = await Promise.all(rawFrames.map(removeBackgroundWithApi));
```

`removeBackgroundWithApi` should convert a canvas to a PNG blob, upload it to the backend, then load the returned transparent image as an `ImageBitmap`, `HTMLImageElement`, or canvas.
