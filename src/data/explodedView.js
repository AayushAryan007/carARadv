/**
 * Exploded-view layout. Each group moves the matching meshes by `offset`
 * (normalised model units). `mirrorX: true` flips the X offset for parts on
 * the right-hand side so left/right wheels move apart.
 *
 * Only meshes that really exist in the model can move. The supplied model has
 * no battery, motor or separate chassis frame — adding them requires modelling
 * those parts as their own named meshes (see README → Exploded view).
 */
export const EXPLODED_GROUPS = [
  { label: 'Roof panel', meshes: ['CarBody 1_Car Paint 2*'], offset: [0, 0.34, 0] },
  { label: 'Glass', meshes: ['CarBody 2_Windows*', 'CarBody 2_WindowBorder*', 'CarBody 2_Wipers*'], offset: [0, 0.24, 0] },
  { label: 'Body panels', meshes: ['CarBody 1_Car Paint_0*', 'CarBody 2_Side Mirrors*', 'CarBody 2_CorvetteWingEmblem*'], offset: [0, 0.16, 0] },
  { label: 'Trim', meshes: ['CarBody 2_Glossy Plastic*', 'CarBody 2_Plastic*', 'CarBody 2_Chrome*', 'CarBody 2_Rubber*', 'CarBody 2_Reflectors*', 'CarBody 2_Side Reflectors*', 'CarBody 2_Mesh*'], offset: [0, 0.1, 0] },
  { label: 'Front lights', meshes: ['CarBody 2_Main Headlight*', 'CarBody 2_Headlight Cover*', 'CarBody 2_Daylight*', 'CarBody 2_Blinker*'], offset: [0, 0.12, 0.12] },
  { label: 'Rear lights', meshes: ['CarBody 2_Tail Lights*', 'CarBody 2_Spoiler Light*', 'License Plate*'], offset: [0, 0.12, -0.12] },
  { label: 'Interior', meshes: ['CarBody 2_Interior*'], offset: [0, 0.05, 0] },
  { label: 'Exhaust', meshes: ['CarBody 2_Exhaust*'], offset: [0, -0.02, -0.12] },
  { label: 'Undercarriage', meshes: ['CarBody 3_*', 'CarBody 2_Shadow*'], offset: [0, -0.06, 0] },
  { label: 'Wheels', meshes: ['Tire *', 'Rim *'], offset: [0.2, 0, 0], mirrorX: true },
  { label: 'Brakes', meshes: ['Brake Disc *', 'Brake Caliper *'], offset: [0.1, 0, 0], mirrorX: true },
];
