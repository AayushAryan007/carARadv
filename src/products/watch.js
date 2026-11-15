import { asset, paths, TBD } from './shared.js';

const ID = 'watch';
const img = (hotspotId) => asset(paths.component(ID, hotspotId));

const M = (...n) => n.map((x) => `Object_${x}`);

/**
 * PRODUCT: Chronograph wrist watch (supplied Casio Edifice model).
 * The source meshes are unnamed (Object_N); they were identified visually with
 * scripts/inspect-parts.mjs. Dial faces +Z, watch stands upright (strap loop).
 * Hotspots without `position` sit at the centre of their meshes (+ `nudge`).
 */
export default {
  id: ID,
  name: 'Chronograph Watch',
  category: 'Watch',
  tagline: 'Dial, hands, bezel and strap — taken apart in 3D.',
  noun: 'watch',
  model: {
    file: paths.model(ID),
    rotationY: 0,
    // The source model sits on an acrylic display stand (holder + base plate) — not part of the watch.
    hide: ['Object_56', 'Object_58'],
    credit: 'Casio Edifice watch 3D model — supplied asset (Sketchfab export). Verify licence & add author credit.',
  },
  ar: {
    // Lying dial-up on the page (tilt -90° about X turns the dial (+Z) to face up; the stage
    // re-centres it automatically), 12 o'clock pointing up the page.
    advert: { scale: 0.55, position: [0, -0.1, 0], heading: -90, tilt: -90 },
    qr: { scale: 0.8, position: [0, 0, 0], heading: -90, tilt: -90 },
  },
  viewer: {
    home: { target: [0, 0.62, 0], dir: [0.35, 0.2, 1], dist: 2.3 },
    hero: { target: [0, 0.6, 0.05], position: [1.05, 0.95, 2.25] },
  },
  specs: {
    title: 'Chronograph Watch',
    note: 'All specifications are placeholders. Replace them in src/products/watch.js with verified data.',
    sections: [
      { title: 'Case', items: [TBD('Case diameter'), TBD('Thickness'), TBD('Case material'), TBD('Water resistance')] },
      { title: 'Movement', items: [TBD('Movement type'), TBD('Accuracy'), TBD('Battery life')] },
      { title: 'Features', items: [TBD('Chronograph'), TBD('Date display'), TBD('Crystal')] },
      { title: 'Strap', items: [TBD('Band material'), TBD('Clasp type'), TBD('Band width')] },
    ],
  },
  advert: {
    headline: ['TIME,', 'TAKEN', 'APART.'],
    sub: 'This page comes alive. Point your phone at it to see the watch in 3D — then explode it into every piece.',
    callouts: [
      { n: '01', label: 'DIAL &amp; HANDS', x: 860, y: 760 },
      { n: '02', label: 'CROWN', x: 900, y: 1180 },
      { n: '03', label: 'BEZEL', x: 84, y: 790 },
    ],
    stats: [['3<em>D</em>', 'Full 360° model'], ['8', 'Explorable parts'], ['0', 'Apps to install']],
    heroStyle: 'left:280px; right:160px; top:700px',
  },
  hotspots: [
    {
      id: 'dial',
      name: 'Dial & Indices',
      short: 'Textured main dial with applied hour markers.',
      details:
        'The main dial carries the applied hour indices and the printed minute track. Its textured finish keeps the hands and markers easy to read.\n\nDial, minute track and indices are separate meshes in the model.',
      specs: [TBD('Dial finish'), TBD('Luminous markers'), TBD('Colour')],
      image: img('dial'),
      meshes: M(66, 46, 7, 8, 42, 44),
      position: [-0.17, 0.5, 0.4],
      distance: 1.15,
    },
    {
      id: 'hands',
      name: 'Hands',
      short: 'Hour, minute and central seconds hands.',
      details:
        'The hour and minute hands are skeletonised with luminous inserts; the long central hand is the chronograph seconds hand.',
      specs: [TBD('Luminous coating'), TBD('Hand style')],
      image: img('hands'),
      meshes: M(10, 11, 16, 17, 13, 14),
      position: [0.07, 0.72, 0.41],
      distance: 1.15,
    },
    {
      id: 'subdials',
      name: 'Chronograph Sub-dials',
      short: 'Three registers for the stopwatch and small seconds.',
      details:
        'The three small registers record elapsed minutes and hours of the chronograph and show running seconds. Each sub-dial has its own face, ring and hand.',
      specs: [TBD('Chronograph range'), TBD('Register layout')],
      image: img('subdials'),
      meshes: M(4, 5, 36, 37, 39, 40, 48, 50, 52, 54, 67, 68, 79),
      position: [-0.12, 0.64, 0.4],
      distance: 1.15,
    },
    {
      id: 'bezel',
      name: 'Bezel',
      short: 'Outer ring framing the crystal.',
      details:
        'The bezel and the inner rings frame the dial and hold the crystal in place. They are separate meshes from the case.',
      specs: [TBD('Bezel material'), TBD('Rotating')],
      image: img('bezel'),
      meshes: M(75, 70, 77),
      position: [0.25, 0.88, 0.4],
      distance: 1.15,
    },
    {
      id: 'crystal',
      name: 'Crystal',
      short: 'Scratch-resistant glass covering the dial.',
      details: 'The crystal protects the dial and hands. It is a separate, transparent mesh in the model.',
      specs: [TBD('Crystal material'), TBD('Anti-reflective coating')],
      image: img('crystal'),
      meshes: M(81),
      position: [-0.13, 0.8, 0.42],
      distance: 1.15,
    },
    {
      id: 'crown',
      name: 'Crown & Pushers',
      short: 'Crown for setting the time, pushers for the chronograph.',
      details:
        'The crown sets the time and date; the two pushers start, stop and reset the chronograph. Their guards protect them from knocks.',
      specs: [TBD('Screw-down crown'), TBD('Pusher type')],
      image: img('crown'),
      meshes: M(23, 25, 27, 29, 31),
      nudge: [0.06, 0, 0],
      view: [1, 0.25, 0.6],
      distance: 0.9,
    },
    {
      id: 'case',
      name: 'Case & Lugs',
      short: 'Main case body, lugs and case back.',
      details:
        'The case houses the movement and connects to the strap through the lugs. The case back closes the movement compartment.',
      specs: [TBD('Case diameter'), TBD('Case material'), TBD('Water resistance')],
      image: img('case'),
      meshes: M(72, 73, 62),
      position: [-0.42, 0.62, 0.3],
      distance: 1.15,
    },
    {
      id: 'strap',
      name: 'Strap & Clasp',
      short: 'Band, keeper and clasp.',
      details: 'The band wraps around the wrist and closes with the clasp at the back. Band, keeper and clasp are separate meshes.',
      specs: [TBD('Band material'), TBD('Clasp type'), TBD('Band width')],
      image: img('strap'),
      meshes: M(33, 34, 60, 64, 19, 21),
      position: [0, 0.07, 0.2],
      view: [0.5, 0.3, 1],
      distance: 1.3,
    },
  ],

  // Exploded view: the layers fan out toward the viewer (+Z), crown/pushers out to the side,
  // strap and case back move back.
  exploded: [
    { label: 'Crystal', meshes: M(81), offset: [0, 0, 0.62] },
    { label: 'Bezel', meshes: M(75), offset: [0, 0, 0.5] },
    { label: 'Inner rings', meshes: M(70, 77), offset: [0, 0, 0.4] },
    { label: 'Hands', meshes: M(10, 11, 16, 17, 13, 14), offset: [0, 0, 0.3] },
    { label: 'Sub-dial hands', meshes: M(4, 5, 36, 37, 39, 40), offset: [0, 0, 0.24] },
    { label: 'Dial print', meshes: M(46, 7, 8, 42, 44), offset: [0, 0, 0.16] },
    { label: 'Sub-dials', meshes: M(48, 50, 52, 54, 67, 68, 79), offset: [0, 0, 0.1] },
    { label: 'Dial', meshes: M(66), offset: [0, 0, 0.04] },
    { label: 'Crown & pushers', meshes: M(23, 25, 27, 29, 31), offset: [0.35, 0, 0] },
    { label: 'Case back', meshes: M(62), offset: [0, 0, -0.18] },
    { label: 'Strap', meshes: M(33, 34, 60, 64, 19, 21), offset: [0, 0, -0.4] },
  ],
};

export { img };
