# AutoVision AR

Scan a printed advert or its QR code with a phone and the product appears on the page in 3D. Users can rotate it, zoom, tap parts to read about them, take it apart in an exploded view, or switch to a full-screen 3D viewer. It runs in the mobile browser, with no app to install.

**Products:** Sports Coupé (car), Chronograph Watch and Pro Laptop 16″. Each has its own advert, its own QR code, hotspots, exploded view and specs, and adding more is one file plus a few commands (see [Adding a product](#adding-a-product)).

**Stack:** Vite · three.js r187 · MindAR 1.2.5 (image tracking) · vanilla JS (no framework)

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173  (3D viewer works; AR needs a camera)
npm run build          # production build → dist/
npm test               # end-to-end test in headless Chrome (run `npm run build` first)
```

**Useful links:**
- `/?view=3d&product=watch` opens the 3D viewer for one product.
- `/?ar=laptop` opens a QR launch screen.
- Add `?debug` to log the mesh name and model-space coordinates of anything you tap. This is useful for placing hotspots.

### Testing on a phone before deploying
Phones only allow camera access over **HTTPS**, so `http://192.168.x.x:5173` will **not** work.
- **Recommended:** deploy to Vercel (below) and open the HTTPS URL.
- **Local alternative:** `npm run dev:https` serves self-signed HTTPS on your LAN. Open the `https://192.168.x.x:5173` address it prints on a phone on the same Wi-Fi and accept the certificate warning.

---

## Project structure

```
index.html                 all screens: QR launch, landing, AR/3D experience, panels
src/
  products/
    index.js               ⚙ product registry + AR target order
    car.js | watch.js | laptop.js   ⚙ one file per product (model, hotspots, exploded view,
                              specs, AR placement, viewer camera, advert text)
    shared.js              asset paths + cache-busting fingerprints
  config.js                ⚙ shared settings: tracking feel, motion sensors, tap tuning
  main.js                  app flow: screens, modes, product switching, taps, controls
  ar/                      camera, MindAR tracking, motion sensors, pose/placement
  three/                   stage, model loader, product manager, hotspots, exploded view, controls
  audio/soundFx.js         synthesized sound design
  components/              info panel, parts list, specs sheet, toast
  styles/main.css          design tokens + all UI styles
public/assets/
  models/<id>.glb          optimized models (car 4.1 MB, watch 1.3 MB, laptop 1.2 MB)
  images/<id>/             hero.webp + components/<hotspot>.webp (rendered from the models)
  targets/advert-<id>.jpg  printable adverts
  targets/targets.mind     ALL AR targets (advert + QR for every product)
  qr/<id>-qr.svg|png|badge.png   QR codes (each is also an AR target)
scripts/                   asset pipeline, inspection tools and tests
resource/                  your original source models (git-ignored)
```

---

## How products work

Each product is one file in `src/products/` with:

| Field | What it does |
|---|---|
| `model.file`, `rotationY`, `hide` | Model path, a turn if the front isn't +Z, and parts to hide. For example, the watch's display stand is hidden. |
| `hotspots[]` | Explorable parts: name, text, specs, `meshes` (the real parts), and the marker position (`position`, or the center of the meshes plus a `nudge`). Optional fields: `view`/`distance` (camera focus), `normal` (which way the surface faces), `image`. |
| `exploded[]` | Groups of meshes and how far each moves (`offset`, `mirrorX` for left/right pairs). |
| `ar.advert` / `ar.qr` | Placement on each target: `scale` (1 = image width), `position`, `heading`, and `tilt` (the watch uses -90 to lie dial-up). |
| `viewer.home` / `viewer.hero` | Default 3D camera and the angle used for the rendered hero image. |
| `specs` | The product's spec sheet. Values are placeholders until verified. |
| `advert` | Headline, text, callouts and stats for the printable advert. |
| `qrPath` | Optional. The car keeps `/?ar` so codes that are already printed keep working. Others use `/?ar=<id>`. |

On load, every model is normalized: **longest horizontal side = 1**, centered, resting on `y = 0`, front toward **+Z**. All coordinates in a product file use this space.

### What scanning does
`targets.mind` contains, **for each product in registry order, [advert, QR]**. Whichever image the camera sees decides which product appears. If you point at the watch QR, the watch loads on it, even if you started from the car. The QR badge and the QR printed on the advert contain the same code as the plain QR, so all three trigger that product.

## Adding a product

1. **Model:** `npm run optimize-model -- resource/<file>.glb public/assets/models/<id>.glb`
2. **Product file:** copy `src/products/watch.js` to `src/products/<id>.js`, change `ID`, names and text, and add it to `PRODUCTS` in `src/products/index.js`.
3. **Identify parts.** Most Sketchfab exports have unnamed meshes (`Object_12`).
   - `node scripts/inspect-model.mjs public/assets/models/<id>.glb` lists every mesh with its size and position.
   - `node scripts/inspect-parts.mjs <id> <outDir> '[{"t":[0,0.3,0],"p":[0.8,0.8,1.2]}]'` renders each mesh highlighted on labeled contact sheets.
   - `node scripts/lib/measure.mjs <id>` prints the normalized bounds and the center of each hotspot.
4. Fill in `hotspots` and `exploded`, then check in the viewer: `npm run dev` → `/?view=3d&product=<id>`.
5. **Images, QR, advert, targets:** `npm run render-images -- <id>`, then `npm run build-advert`. This rebuilds every advert and QR and recompiles `targets.mind` with the new product.
6. `npm run build && npm test`, then commit `src/products`, `public/assets` and push.

### Model notes
- `optimize-model` keeps mesh **names**, simplifies geometry (error-bounded), converts textures to 1024 px WebP, and applies Meshopt compression. The three.js `MeshoptDecoder` decodes it, so there are no extra WASM files to host. Use `--texture=2048` or `--simplify=0.75` for more detail.
- Glass using `KHR_materials_transmission` is converted to simple transparency, because transmission turns black over the camera feed in AR.
- **Exploding needs separate meshes.** A model that is one merged mesh cannot be taken apart automatically. You would need to split it in Blender first.

## Hotspots: mesh-linked vs visual-only
- **Mesh-linked** (`meshes: [...]`): tied to real geometry. Tapping the **actual part** selects it by raycasting, the real meshes glow, and the panel says "Linked to 3D mesh". **All hotspots of all three products are mesh-linked.**
- **Visual-only** (`meshes: []`): for parts a model lacks. The marker is drawn dashed with an "approximate area" sphere, and the panel says "Visual hotspot · approx. location".

Mesh patterns ignore case, spaces and underscores, and `*` is a wildcard.

## Specifications
All values are **placeholders**, marked "placeholder" in the UI. None of them is manufacturer data. Edit each product's `specs` and hotspot `specs`, and set `placeholder: false` once a value is verified.

---

## Viewing from every angle (motion sensors)
Image tracking alone has two limits: it drops out at steep angles or when the image leaves the frame, and it doesn't know which way is "down". `src/ar/poseManager.js` fixes both using the phone's gyroscope and accelerometer:

- **Gravity-aligned placement.** Products always stand upright relative to real gravity. If the advert is flat on a table, the product sits on the page and the watch lies dial-up. If it's on a wall or laptop screen, the product stands in front of it facing you, instead of sticking out of the page.
- **Motion-sensor hold.** When the camera loses the advert (steep angle, partly out of frame), the car stays where it was and counter-rotates with the phone, so you can keep looking around it. When the advert is back in view, it snaps back to precise image tracking. The chip at the top shows "Holding with motion sensors" while this is active.
- Tune both in `CONFIG.ar` (`gravityAlign`, `motionHold`, `motionHoldMs`, `uprightYaw`, `uprightDrop`).
- iPhone asks "Allow access to motion & orientation" the first time you tap **Start AR**. Tap **Allow**. If you deny it, AR still works with page-based placement only.
- Motion hold tracks **rotation only**. If you walk far away from the page while it is lost, the car can drift until the advert is seen again.

## Sound design
`src/audio/soundFx.js` synthesizes every sound live with the Web Audio API, so there are no audio files: an ambient drone, sonar pings while scanning, a lock-on chime with a haptic buzz, a tracking-lost tone, selection blips, explode/assemble sweeps and mode-switch whooshes. The speaker button in the top bar mutes and unmutes, and the choice is remembered.

## QR codes: scan it, then see the product on it
Every product's QR code is both the **link** and an **AR target**:
1. Scanning it with the phone's camera opens `https://<your-app>/?ar=<id>` (the car uses `/?ar`). This is a one-tap **"Tap to launch AR"** screen for that product. Browsers require a tap before they allow the camera, sound and iPhone motion sensors.
2. Point the camera at the **same QR code** and the product appears on it. The watch lies dial-up; the car and laptop stand on the code.

**Regenerate after changing the URL or the products:**
1. `npm pkg set homepage=https://your-app.vercel.app`
2. `npm run build-advert`. This runs `make-qr` (writes `public/assets/qr/<id>-qr.svg|png|badge`), re-renders every advert with its QR, and recompiles all targets.
3. Commit everything in `public/assets/qr` and `public/assets/targets`.

**Using your own newspaper advert for a product:** replace `public/assets/targets/advert-<id>.jpg` with it, then run `npm run build-advert -- --no-render`.

**Printing for AR:** make the QR at least **5 × 5 cm** (badge at least 6 cm wide). The code has to fill a good part of the camera view to be recognized as an AR target. Use dark on light and keep the white margin. Asset URLs carry a content fingerprint (`?v=…`), so phones never use a stale target.

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
- Check that the product appears and stays locked to the page, drag to spin, pinch to zoom, tap markers, try the Parts list, Explode, *3D View* → *Back to AR*, then the back arrow (the camera light should switch off).

---

## Automated tests (`npm test`)
The tests drive the **production build** in real Chrome. For AR, they feed adverts and QR codes to Chrome as a **fake camera**, so MindAR's detection actually runs. 41 checks cover:
- landing page, model load and normalization, hotspot tap → panel, raycast selection of real geometry, drag-doesn't-select, parts list, exploded view and zoom
- **every product**: hotspots, exploded view, parts list and rendered images
- mobile layout, camera start, **target detection**, AR hotspot tap, gravity placement and motion hold
- the **car QR, watch QR and laptop advert each showing the right product**
- AR ⇄ 3D switching, camera release on exit, and the denied-permission error

Screenshots go to `test-results/`.

The fake camera looks straight down at a flat image, so it proves the pipeline works. It does not test real-world lighting, focus or hand shake. Always do the manual phone test above.

---

## Licences & credits
- Project code: MIT.
- [MindAR](https://github.com/hiukim/mind-ar-js) (MIT, © 2020 hiukim). `src/ar/imageTracking.js` adapts its three.js anchor and projection maths. We call MindAR's tracking `Controller` directly because its prebuilt `MindARThree` imports `sRGBEncoding`, which was removed in three.js r162.
- [three.js](https://github.com/mrdoob/three.js) (MIT).
- Reference repo [thiefcoder/web-ar-Image-Tracking](https://github.com/thiefcoder/web-ar-Image-Tracking) (**GPL-3.0**) was reviewed but **no code was copied**. It is a single A-Frame HTML page with hard-coded targets, so only its general tuning ideas (smoothing / warm-up / miss tolerance) informed `CONFIG.ar`. This keeps this project free of GPL obligations.
- Inter & Space Grotesk fonts (SIL OFL), self-hosted via Fontsource.
- **3D models (supplied by the project owner, Sketchfab exports):** Chevrolet Corvette C7, Casio Edifice watch, and MacBook Pro 16" (M3, 2024). ⚠ Check each model's licence on its Sketchfab page and put the required author credit in that product's `model.credit` (shown in *About*). Chevrolet/Corvette (GM), Casio/Edifice (Casio) and Apple/MacBook are trademarks of their owners, and the models show their logos. For public or commercial use, make sure you have the rights or use unbranded models.
