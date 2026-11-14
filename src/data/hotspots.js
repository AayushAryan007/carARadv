/**
 * Component hotspots — the single place to edit what users can explore.
 *
 * Two kinds of hotspot exist, and the UI tells users which is which:
 *
 *  1. MESH-LINKED  (meshes: [...] is non-empty)
 *     Tapping the marker OR tapping the actual geometry (raycast) selects the
 *     component, and the real meshes are highlighted.
 *
 *  2. VISUAL-ONLY  (meshes: [])
 *     The model has no geometry for this part. The marker sits at a hand-placed
 *     coordinate and a translucent "approximate area" sphere is shown instead
 *     of a mesh highlight. It does NOT represent real component selection.
 *
 * Fields
 *  id           unique id (used in URLs/analytics)
 *  name         display name
 *  short        one-line summary (component list + panel subtitle)
 *  details      longer explanation (plain text, \n\n for paragraphs)
 *  specs        [{ label, value, placeholder }]  placeholder:true shows a "To verify" badge
 *  image        optional supporting image (path under /public), null to hide
 *  meshes       mesh-name patterns. Case/space/underscore-insensitive, "*" = wildcard.
 *               Run the app with ?debug and tap the car to log mesh names.
 *  position     marker position in normalised model space [x, y, z]
 *               (car length = 1, centred, ground y = 0, nose toward +Z, driver's left = +X)
 *  radius       (visual-only) size of the approximate-area sphere
 *  view         optional camera direction [x,y,z] used when the 3D viewer focuses this part
 *  distance     optional camera distance for that focus (default 0.75)
 *
 * With the supplied model every hotspot below is mesh-linked. Visual-only
 * hotspots remain supported for parts a future model does not contain.
 * Spec values are placeholders until you supply verified data — nothing here
 * is manufacturer data.
 */
const base = import.meta.env?.BASE_URL ?? '/';
const img = (id) => `${base}assets/images/components/${id}.webp`;
const TBD = (label) => ({ label, value: 'To be verified', placeholder: true });

export const HOTSPOTS = [
  {
    id: 'headlights',
    name: 'Headlights',
    short: 'Front lighting cluster with lens, cover and daytime running light.',
    details:
      'The front lighting cluster combines the main projector lens, the protective outer cover, the daytime running light strip and the turn-indicator glass.\n\nIn this model each of these is a separate mesh, so the whole cluster is highlighted when selected.',
    specs: [TBD('Light source'), TBD('Daytime running lights'), TBD('Adaptive / auto-levelling')],
    image: img('headlights'),
    meshes: ['CarBody 2_Main Headlight Lens*', 'CarBody 2_Headlight Cover*', 'CarBody 2_Daylight Cover*', 'CarBody 2_Blinker Glass Cover*'],
    position: [0.135, 0.165, 0.405],
  },
  {
    id: 'wheels',
    name: 'Wheels & Tyres',
    short: 'Four alloy wheels with performance tyres.',
    details:
      'Front and rear wheels each consist of a rim, lug nuts, centre emblem and tyre. All four corners are separate meshes in the model and are highlighted together.\n\nTyre size and wheel diameter are placeholders until verified.',
    specs: [TBD('Front tyre size'), TBD('Rear tyre size'), TBD('Wheel diameter'), TBD('Wheel material')],
    image: img('wheels'),
    meshes: ['Tire *', 'Rim *'],
    position: [0.215, 0.085, -0.306],
    distance: 0.9,
  },
  {
    id: 'grilles',
    name: 'Grilles & Air Vents',
    short: 'Front grille, bonnet vent and side intakes that feed cooling air.',
    details:
      'The mesh grilles in the front bumper, the bonnet vent and the side vents channel air to the radiators and brakes and let hot air escape from the engine bay.\n\nAll grille surfaces share one mesh in the model, so they are highlighted together.',
    specs: [TBD('Cooling layout'), TBD('Active aero / shutters')],
    image: img('grilles'),
    meshes: ['CarBody 2_Mesh*'],
    position: [0.06, 0.1, 0.47],
    view: [0.5, 0.35, 1],
    distance: 0.8,
  },
  {
    id: 'underbody',
    name: 'Wheel Arches & Underbody',
    short: 'Wheel-arch liners and the underside of the car.',
    details:
      'The wheel-arch liners shield the body from water, stones and road debris thrown up by the tyres, and the underside panels smooth the airflow beneath the car.\n\nIn this model the arch liners and underside are one separate mesh.',
    specs: [TBD('Liner material'), TBD('Underbody aero'), TBD('Ground clearance')],
    image: img('underbody'),
    meshes: ['CarBody 3_Undercarriage*'],
    position: [0.2, 0.13, 0.3],
    view: [1, 0.25, 0.35],
    distance: 0.9,
  },
  {
    id: 'interior',
    name: 'Dashboard & Interior',
    short: 'Cockpit, seats and driver controls.',
    details:
      'The cabin mesh contains the dashboard, seats, steering wheel and trim as a single interior object, visible through the glass.\n\nSelecting it highlights the full interior mesh.',
    specs: [TBD('Seating capacity'), TBD('Display size'), TBD('Upholstery')],
    image: img('interior'),
    meshes: ['CarBody 2_Interior*'],
    position: [0.07, 0.205, 0.02],
    view: [1, 0.8, 0.2],
    distance: 0.8,
  },
  {
    id: 'roof',
    name: 'Roof Panel',
    short: 'Removable roof panel (shown here in place of a panoramic roof).',
    details:
      'The supplied model has a separate body-coloured roof panel rather than a glass panoramic roof. It is mesh-linked, so tapping the roof selects it.\n\nReplace this entry if your final model includes a glass roof mesh.',
    specs: [TBD('Roof type'), TBD('Material'), TBD('Removable')],
    image: img('roof'),
    meshes: ['CarBody 1_Car Paint 2*'],
    position: [0, 0.285, -0.09],
    view: [0.8, 1.0, 0.3],
    distance: 0.85,
  },
  {
    id: 'mirrors',
    name: 'Side Mirrors',
    short: 'Door mirror glass for rear visibility.',
    details:
      'The door mirrors give the driver a view down each side of the car. In this model the mirror glass of both mirrors is a separate mesh (the housings are part of the body paint), so the glass is what lights up — best seen from behind the car.',
    specs: [TBD('Heated'), TBD('Power folding'), TBD('Auto-dimming')],
    image: img('mirrors'),
    meshes: ['CarBody 2_Side Mirrors*'],
    position: [0.236, 0.21, 0.006],
    view: [0.5, 0.4, -1],
    distance: 0.6,
  },
  {
    id: 'brakes',
    name: 'Braking System',
    short: 'Ventilated discs with multi-piston callipers.',
    details:
      'Each corner has a brake disc and calliper modelled as separate meshes. Selecting the braking system highlights all four discs and callipers.',
    specs: [TBD('Front disc diameter'), TBD('Rear disc diameter'), TBD('Calliper type'), TBD('Regenerative braking')],
    image: img('brakes'),
    meshes: ['Brake Disc *', 'Brake Caliper *'],
    position: [-0.2, 0.115, 0.272],
  },
  {
    id: 'glass',
    name: 'Windscreen & Glass',
    short: 'Windscreen, side windows and rear glass hatch.',
    details:
      'The glazing includes the raked windscreen, the frameless side windows and the large rear glass over the boot. Rubber seals and the black window borders are separate meshes.\n\nSelecting it highlights all glass panels.',
    specs: [TBD('Windscreen type'), TBD('Tint / UV protection')],
    image: img('glass'),
    meshes: ['CarBody 2_Windows*'],
    position: [-0.08, 0.235, -0.25],
    view: [-0.6, 0.9, -0.8],
    distance: 0.85,
  },
  {
    id: 'rearlights',
    name: 'Rear Lights',
    short: 'Tail-light clusters and high-mounted brake light.',
    details:
      'Rear lighting is made of the red tail-light covers, the white reverse-light covers and the spoiler brake light — all separate meshes in the model.',
    specs: [TBD('Light source'), TBD('Sequential indicators')],
    image: img('rearlights'),
    meshes: ['CarBody 2_Tail Lights*', 'CarBody 2_Spoiler Light Cover*'],
    position: [0.12, 0.195, -0.478],
  },
  {
    id: 'exhaust',
    name: 'Exhaust',
    short: 'Centre-exit exhaust tips and housing.',
    details:
      'The exhaust tips and their housing are separate meshes in the model. On an electric conversion this area would typically be replaced by a diffuser.',
    specs: [TBD('Configuration'), TBD('Material')],
    image: img('exhaust'),
    meshes: ['CarBody 2_Exhaust*'],
    position: [0, 0.07, -0.49],
  },
];
