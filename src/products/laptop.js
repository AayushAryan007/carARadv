import { asset, paths, TBD } from './shared.js';

const ID = 'laptop';
const img = (hotspotId) => asset(paths.component(ID, hotspotId));

const M = (...n) => n.map((x) => `Object_${x}`);

/**
 * PRODUCT: 16-inch laptop (supplied MacBook Pro M3 model).
 * The source meshes are unnamed (Object_N); they were identified visually with
 * scripts/inspect-parts.mjs. Open laptop, front (trackpad) toward +Z, lid at the back.
 * Hotspots without `position` sit at the centre of their meshes (+ `nudge`).
 */
export default {
  id: ID,
  name: 'Pro Laptop 16″',
  category: 'Laptop',
  tagline: 'Display, keyboard, trackpad and ports — explorable in 3D.',
  noun: 'laptop',
  model: {
    file: paths.model(ID),
    rotationY: 0,
    hide: [],
    credit: 'MacBook Pro 16" (M3, 2024) 3D model — supplied asset (Sketchfab export). Verify licence & add author credit.',
  },
  ar: {
    // Open laptop, keyboard toward the bottom edge of the page (toward the viewer).
    advert: { scale: 0.75, position: [0, -0.1, 0], heading: -90 },
    qr: { scale: 1.0, position: [0, 0, 0], heading: -90 },
  },
  viewer: {
    home: { target: [0, 0.22, 0], dir: [0.55, 0.55, 1], dist: 1.9 },
    hero: { target: [0, 0.22, 0.02], position: [0.95, 0.6, 1.25] },
  },
  specs: {
    title: 'Pro Laptop 16″',
    note: 'All specifications are placeholders. Replace them in src/products/laptop.js with verified data.',
    sections: [
      { title: 'Display', items: [TBD('Size'), TBD('Resolution'), TBD('Brightness'), TBD('Refresh rate')] },
      { title: 'Performance', items: [TBD('Processor'), TBD('Memory'), TBD('Storage')] },
      { title: 'Battery & ports', items: [TBD('Battery life'), TBD('Charging'), TBD('Ports')] },
      { title: 'Build', items: [TBD('Enclosure'), TBD('Weight'), TBD('Thickness')] },
    ],
  },
  advert: {
    headline: ['OPEN.', 'EXPLORE.', 'UNFOLD.'],
    sub: 'This page comes alive. Point your phone at it to explore every part of the laptop in 3D — right here on the paper.',
    callouts: [
      { n: '01', label: 'DISPLAY', x: 900, y: 650 },
      { n: '02', label: 'TRACKPAD', x: 760, y: 1215 },
      { n: '03', label: 'KEYBOARD', x: 84, y: 790 },
    ],
    stats: [['3<em>D</em>', 'Full 360° model'], ['9', 'Explorable parts'], ['0', 'Apps to install']],
    heroStyle: 'left:230px; right:110px; top:690px',
  },
  hotspots: [
    {
      id: 'display',
      name: 'Display',
      short: 'Large high-resolution panel with thin bezels.',
      details: 'The display panel and its black bezel are separate meshes inside the aluminium lid.',
      specs: [TBD('Size'), TBD('Resolution'), TBD('Peak brightness'), TBD('Refresh rate')],
      image: img('display'),
      meshes: M(123, 129),
      position: [-0.18, 0.42, -0.33],
      view: [0.25, 0.25, 1],
      distance: 1.3,
      normal: [0, 0.35, 1], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'camera',
      name: 'Camera Notch',
      short: 'Front camera housed in the top bezel.',
      details: 'The camera module sits in a notch at the top centre of the display bezel.',
      specs: [TBD('Camera resolution'), TBD('Microphones')],
      image: img('camera'),
      meshes: M(107, 109, 113, 115),
      nudge: [0, 0.01, 0.03],
      view: [0.15, 0.1, 1],
      distance: 0.55,
      normal: [0, 0.35, 1], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'keyboard',
      name: 'Keyboard',
      short: 'Full-size backlit keyboard.',
      details: 'Keycaps, their legends and the keyboard frame are separate meshes — in the exploded view they lift off the top case layer by layer.',
      specs: [TBD('Layout'), TBD('Backlight'), TBD('Key travel')],
      image: img('keyboard'),
      meshes: M(84, 76, 34, 80, 36),
      position: [-0.2, 0.05, 0.0],
      view: [0.2, 1, 0.6],
      distance: 0.9,
      normal: [0, 1, 0], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'trackpad',
      name: 'Trackpad',
      short: 'Large glass trackpad.',
      details: 'The trackpad surface and its surround are separate meshes in front of the keyboard.',
      specs: [TBD('Size'), TBD('Haptic feedback')],
      image: img('trackpad'),
      meshes: M(32, 38, 48),
      nudge: [0, 0.01, 0],
      view: [0.2, 1, 0.7],
      distance: 0.8,
      normal: [0, 1, 0], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'touchid',
      name: 'Touch ID',
      short: 'Fingerprint sensor in the power key.',
      details: 'The top-right key doubles as power button and fingerprint sensor; its ring and surface are separate meshes.',
      specs: [TBD('Biometric'), TBD('Secure enclave')],
      image: img('touchid'),
      meshes: M(58, 60, 72),
      nudge: [0, 0.01, 0],
      view: [0.3, 1, 0.5],
      distance: 0.5,
      normal: [0, 1, 0], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'speakers',
      name: 'Speaker Grilles',
      short: 'Stereo speakers either side of the keyboard.',
      details: 'Both speaker grilles flanking the keyboard are a single mesh in the model, so they highlight together.',
      specs: [TBD('Speaker system'), TBD('Spatial audio')],
      image: img('speakers'),
      meshes: M(66),
      position: [0.44, 0.045, -0.04],
      view: [0.5, 1, 0.5],
      distance: 0.7,
      normal: [0, 1, 0], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'ports',
      name: 'Ports',
      short: 'Connectors on both sides of the base.',
      details: 'The charging, data and audio ports are small separate meshes on the left and right edges of the base.',
      specs: [TBD('Charging port'), TBD('Data ports'), TBD('Video out'), TBD('Audio jack')],
      image: img('ports'),
      meshes: M(12, 14, 18, 56, 62),
      position: [-0.51, 0.025, 0.0],
      view: [-1, 0.3, 0.4],
      distance: 0.6,
      normal: [-1, 0.2, 0], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'hinge',
      name: 'Hinge',
      short: 'Hinge assembly joining lid and base.',
      details: 'The hinge cover and its internal parts run along the back edge of the base and hold the lid at any angle.',
      specs: [TBD('Opening angle')],
      image: img('hinge'),
      meshes: M(111, 10, 86, 88, 90, 92, 99, 101, 105, 121, 127),
      position: [0.3, 0.05, -0.23],
      view: [0.6, 0.6, 1],
      distance: 0.8,
      normal: [0, 1, 0.3], // outward direction of the surface (marker dims when it faces away)
    },
    {
      id: 'enclosure',
      name: 'Aluminium Enclosure',
      short: 'Unibody top case and outer shell.',
      details: 'The top case (palm rest) and the outer unibody shell are separate meshes from the keyboard, trackpad and bottom panels.',
      specs: [TBD('Material'), TBD('Weight'), TBD('Thickness')],
      image: img('enclosure'),
      meshes: M(22, 68, 74, 52),
      position: [-0.4, 0.04, 0.38],
      view: [-0.5, 0.6, 1],
      distance: 0.9,
      normal: [0, 1, 0.5], // outward direction of the surface (marker dims when it faces away)
    },
  ],

  // Exploded view: keyboard stack lifts off the top case, display slides forward out of
  // the lid, lid shell moves back, bottom panels drop, ports slide outward.
  exploded: [
    { label: 'Touch ID', meshes: M(58, 60, 72), offset: [0, 0.34, 0] },
    { label: 'Keycaps', meshes: M(84, 76), offset: [0, 0.28, 0] },
    { label: 'Keyboard frame', meshes: M(34, 80, 36), offset: [0, 0.2, 0] },
    { label: 'Trackpad', meshes: M(32, 38, 48), offset: [0, 0.2, 0.14] },
    { label: 'Speakers', meshes: M(66), offset: [0, 0.15, 0] },
    { label: 'Top case', meshes: M(68), offset: [0, 0.1, 0] },
    { label: 'Display', meshes: M(123, 129), offset: [0, 0.08, 0.16] },
    { label: 'Camera', meshes: M(107, 109, 113, 115), offset: [0, 0.12, 0.2] },
    { label: 'Lid shell', meshes: M(103, 117, 119, 131, 125), offset: [0, 0.05, -0.14] },
    { label: 'Hinge', meshes: M(111, 10, 86, 88, 90, 92, 99, 101, 105, 121, 127), offset: [0, -0.02, -0.08] },
    { label: 'Bottom panels', meshes: M(16, 26, 28, 30, 40, 42, 70, 54, 82), offset: [0, -0.18, 0] },
    { label: 'Ports', meshes: M(12, 14, 18, 56, 62), offset: [0.16, 0, 0], mirrorX: true },
  ],
};

export { img };
