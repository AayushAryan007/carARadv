# AutoVision AR

Scan a printed car advert with a phone and the car appears on the page in 3D. Users can rotate it, zoom, tap parts to read about them, open an exploded view, or switch to a full-screen 3D viewer. It runs in the mobile browser, with no app to install.

**Stack:** Vite · three.js r187 · MindAR 1.2.5 (image tracking) · vanilla JS (no framework)

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173  (3D viewer works; AR needs a camera)
npm run build          # production build → dist/
npm test               # end-to-end test in headless Chrome (run `npm run build` first)
```

Open `/?view=3d` to jump straight into the 3D viewer, or add `?debug` to log the mesh name and model-space coordinates of anything you tap (useful for placing hotspots).

### Testing on a phone before deploying
Phones only allow camera access over **HTTPS**, so `http://192.168.x.x:5173` will **not** work.
- **Recommended:** deploy to Vercel (below) and open the HTTPS URL.
- **Local alternative:** `npm run dev:https` serves self-signed HTTPS on your LAN. Open the `https://192.168.x.x:5173` address it prints on a phone on the same Wi-Fi and accept the certificate warning.

---

## Project structure

```
index.html                 all screens: landing, AR/3D experience, panels
src/
  main.js                  app flow: screens, modes, taps, controls
  config.js                ⚙ model path, target path, AR placement, tracking tuning
  data/
    hotspots.js            ⚙ components: names, meshes, positions, text, specs, images
    vehicleData.js         ⚙ vehicle specification sheet (placeholders)
    explodedView.js        ⚙ which meshes move where in exploded view
  ar/
    camera.js              camera permission + rear-camera request + error messages
    imageTracking.js       MindAR tracking Controller → three.js anchor
  three/
    stage.js               shared renderer/scene/lighting; AR ⇄ viewer re-parenting
    modelLoader.js         GLB loading (Meshopt), normalisation, mesh-name matching
    hotspotManager.js      markers, raycast selection, highlighting
    explodedView.js        exploded-view animation
    viewerControls.js      orbit viewer + AR rotate/pinch gestures
  components/              info panel, component list, specs sheet, toast
  styles/main.css          design tokens + all UI styles
public/assets/
  models/car.glb           optimised car model (4.1 MB)
  targets/targets.mind     compiled MindAR image target
  targets/advert.jpg       the printable advert that matches targets.mind
  images/hero.webp         landing hero (rendered from the model)
  images/components/*.webp info-panel images (rendered from the model)
scripts/                   asset pipeline + tests (see below)
resource/                  your original source files (original GLB is git-ignored)
```

---

## Replacing assets

| What | Replace | Then run |
|---|---|---|
| **Car model** | your `.glb` | `npm run optimize-model -- path/to/car.glb` → writes `public/assets/models/car.glb` |
| **Advert / target image** | your advert JPG/PNG | `npm run compile-target -- path/to/advert.jpg`, then copy the image to `public/assets/targets/advert.jpg` |
| **Hero + panel images** | — | `npm run render-images` (re-renders from the current model) |
| **Component info** | `src/data/hotspots.js` | — |
| **Specifications** | `src/data/vehicleData.js` | — |
| **Car placement on the page** | `CONFIG.ar` in `src/config.js` (`scale`, `position`, `heading`) | — |

### Model notes
- `optimize-model` keeps mesh **names**, which the hotspots and exploded view depend on. It simplifies geometry (error-bounded), converts textures to 1024 px WebP, and applies Meshopt compression. The three.js `MeshoptDecoder` decodes it, so there are no extra WASM files to host. Use `--texture=2048` or `--simplify=0.75` for more detail.
- On load, every model is normalised so that its **length = 1**, it is centred, and its wheels rest on `y = 0`. Hotspot coordinates use this space, with the nose pointing to **+Z** and the driver's left at **+X**. If your model's nose points elsewhere, set `CONFIG.model.rotationY`.
- `.gltf` with external `.bin` and textures also works. Put the files together in `public/assets/models/` and point `CONFIG.model.url` at the `.gltf`.
- Glass using `KHR_materials_transmission` is converted to simple transparency, because transmission turns black over the camera feed in AR.

### Image target: how to generate it
1. Use a print-ready advert with **lots of sharp, high-contrast detail spread across the page**. Avoid big flat areas, plain gradients and repeating patterns. About 1000 px wide is plenty.
2. `npm run compile-target -- my-advert.jpg` writes `public/assets/targets/targets.mind`. Several images can be compiled into several targets (index 0, 1, …). To use one of the others, set `CONFIG.target.index`.
   *Without Node:* use MindAR's web compiler at <https://hiukim.github.io/mind-ar-js-doc/tools/compile> and save the result as `public/assets/targets/targets.mind`.
3. The included advert is generated from `scripts/advert/advert.html`. Edit it and run `npm run build-advert`, which renders it and compiles the target in one step.
4. **QR code on the advert:** `APP_URL=https://your-app.vercel.app npm run build-advert` prints a QR code linking to the app in the "Scan this page" box. Commit the new `advert.jpg` + `targets.mind` (the target changes whenever the advert does).

---

## Hotspots: mesh-linked vs visual-only

These are deliberately kept separate in the code and the UI.

- **Mesh-linked** (`meshes: [...]`): the hotspot is tied to real geometry. Tapping the **actual part** selects it by raycasting, and the real meshes glow. The panel shows a "Linked to 3D mesh" badge.
- **Visual-only** (`meshes: []`): the model has no geometry for the part, so the marker sits at a hand-placed coordinate and a translucent "approximate area" sphere appears instead of a highlight. The panel shows a "Visual hotspot · approx. location" badge, and the marker is drawn dashed.

Mesh patterns ignore case, spaces and underscores, and `*` is a wildcard (e.g. `'Tire *'` matches all four tyres). If a pattern matches nothing, the console warns and the hotspot falls back to visual-only.

**With the supplied Corvette C7 model, all 11 hotspots are mesh-linked:** headlights, wheels & tyres, grilles & air vents, wheel arches & underbody, dashboard & interior, roof panel, side mirrors (mirror glass), braking system, windscreen & glass, rear lights, and exhaust. The model is a petrol car, so EV parts (battery, electric motor, charging port) and suspension, which are not modelled, were replaced with real parts. Visual-only hotspots are still supported if a future model lacks a part.

## Exploded view
This moves **real, separately named meshes**: roof panel, glass, body panels, trim, lights, interior, exhaust, undercarriage, wheels and brakes. Battery, motor and a separate chassis frame are not in the model, so they cannot move. To add them, model each one as its own named mesh in Blender (or similar), export the GLB, run `optimize-model`, and add an entry to `src/data/explodedView.js`. A single merged mesh cannot be exploded automatically.

## Specifications
All values are **placeholders** and are marked "placeholder" in the UI. None of them is manufacturer data. Edit `src/data/vehicleData.js` and `specs` in `hotspots.js`, and set `placeholder: false` once a value is verified.

---

## Viewing from every angle (motion sensors)
Image tracking alone has two limits: it drops out at steep angles or when the advert leaves the frame, and it doesn't know which way is "down". `src/ar/poseManager.js` fixes both using the phone's gyroscope and accelerometer:

- **Gravity-aligned placement.** The car always stands wheels-down relative to real gravity. If the advert is flat on a table, the car sits on the page. If it's on a wall or laptop screen, the car stands upright in front of it with a ¾ turn toward you, instead of sticking out of the page.
- **Motion-sensor hold.** When the camera loses the advert (steep angle, partly out of frame), the car stays where it was and counter-rotates with the phone, so you can keep looking around it. When the advert is back in view, it snaps back to precise image tracking. The chip at the top shows "Holding with motion sensors" while this is active.
- Tune both in `CONFIG.ar` (`gravityAlign`, `motionHold`, `motionHoldMs`, `uprightYaw`, `uprightDrop`).
- iPhone asks "Allow access to motion & orientation" the first time you tap **Start AR**. Tap **Allow**. If you deny it, AR still works with page-based placement only.
- Motion hold tracks **rotation only**. If you walk far away from the page while it is lost, the car can drift until the advert is seen again.

## Sound design
`src/audio/soundFx.js` synthesizes every sound live with the Web Audio API, so there are no audio files: an ambient drone, sonar pings while scanning, a lock-on chime with a haptic buzz, a tracking-lost tone, selection blips, explode/assemble sweeps and mode-switch whooshes. The speaker button in the top bar mutes and unmutes, and the choice is remembered.

## QR code (for the newspaper / advert)
1. Set the live URL once: `npm pkg set homepage=https://your-app.vercel.app`
2. `npm run make-qr` writes to `public/assets/qr/`:
   - `autovision-ar-qr.svg`: vector, best for print layout tools
   - `autovision-ar-qr.png`: 2000 px
   - `autovision-ar-qr-badge.png`: branded "Scan to experience in AR" badge

   The landing page shows a **Download QR code** link once these files exist.
3. `npm run build-advert` re-renders the demo advert with the QR in its bottom panel and **recompiles the target**. The QR is part of the scanned image, so always commit `advert.jpg` and `targets.mind` together.

Print the QR at least 2 × 2 cm, dark on light, with its white margin kept.

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. On <https://vercel.com/new>, import the repo. `vercel.json` already sets:
   - **Framework:** Vite · **Install:** `npm ci --ignore-scripts` · **Build command:** `npm run build` · **Output directory:** `dist`
   - `--ignore-scripts` skips compiling `canvas`, a native package MindAR pulls in that is only needed by the local target compiler (`npm run compile-target`), not by the website. Without it, builds fail on Node versions that have no prebuilt `canvas` binary.
3. Deploy. Vercel serves HTTPS automatically, which the camera requires.

Or use the CLI: `npx vercel` (preview) / `npx vercel --prod`.
Cloudflare Pages works with the same build command and output directory. For GitHub Pages under a sub-path, set `base` in `vite.config.js` to `/<repo>/`.

### Testing on phones
- **Android:** open the HTTPS URL in **Chrome**, tap *Start AR Experience*, then tap **Allow** for the camera. If you blocked it earlier, go to the lock icon → Permissions → Camera → Allow, then tap Retry.
- **iPhone:** open the URL in **Safari** (iOS 15+). Allow the camera. If you blocked it earlier, go to Settings › Safari › Camera, or **aA** → Website Settings → Camera.
- Avoid in-app browsers (Instagram, Facebook, some QR scanners), which often block the camera. Open the link in Chrome or Safari instead.
- Show the advert on paper or on another screen. Hold the phone 25–40 cm away with the whole advert in view, in even light and without glare.
- Check that the car appears and stays locked to the page, drag to spin, pinch to zoom, tap markers, try the Parts list, Explode, *3D View* → *Back to AR*, then the back arrow (the camera light should switch off).

---

## Automated tests (`npm test`)
The tests drive the **production build** in real Chrome. For AR, they feed `advert.jpg` to Chrome as a **fake camera**, so MindAR's detection actually runs. They cover: landing page, model load and normalisation, hotspot tap → panel, raycast selection of real wheel geometry, drag-doesn't-select, component list, exploded view, zoom, mobile layout overflow, camera start, **target detection**, AR hotspot tap, AR ⇄ 3D switching, camera release on exit, and the denied-permission error. Screenshots go to `test-results/`.

The fake camera looks straight down at a flat image, so it proves the pipeline works. It does not test real-world lighting, focus or hand shake. Always do the manual phone test above.

---

## Licences & credits
- Project code: MIT.
- [MindAR](https://github.com/hiukim/mind-ar-js) (MIT, © 2020 hiukim). `src/ar/imageTracking.js` adapts its three.js anchor and projection maths. We call MindAR's tracking `Controller` directly because its prebuilt `MindARThree` imports `sRGBEncoding`, which was removed in three.js r162.
- [three.js](https://github.com/mrdoob/three.js) (MIT).
- Reference repo [thiefcoder/web-ar-Image-Tracking](https://github.com/thiefcoder/web-ar-Image-Tracking) (**GPL-3.0**) was reviewed but **no code was copied**. It is a single A-Frame HTML page with hard-coded targets, so only its general tuning ideas (smoothing / warm-up / miss tolerance) informed `CONFIG.ar`. This keeps this project free of GPL obligations.
- Inter & Space Grotesk fonts (SIL OFL), self-hosted via Fontsource.
- **Car model:** Chevrolet Corvette C7 (Sketchfab export, supplied by the project owner). ⚠ Check the model's licence on its Sketchfab page and add the required author credit to `CONFIG.model.credit` (shown in *About*). "Chevrolet" and "Corvette" are trademarks of General Motors. For public or commercial use, use a model and branding you have the rights to.
