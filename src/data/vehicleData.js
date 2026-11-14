/**
 * Vehicle specifications shown in the "Specs" sheet.
 *
 * Every value is a PLACEHOLDER until you replace it with verified data.
 * Set `placeholder: false` (or remove it) once a value is confirmed and the
 * "To verify" badge disappears.
 */
const P = (label, value = 'To be verified') => ({ label, value, placeholder: true });

export const VEHICLE = {
  name: 'Concept Coupé',
  tagline: 'Interactive showroom demo',
  note: 'All specifications are placeholders. Replace them in src/data/vehicleData.js with verified data.',
  sections: [
    {
      title: 'Performance',
      items: [P('Power'), P('Torque'), P('0–100 km/h'), P('Top speed')],
    },
    {
      title: 'Powertrain',
      items: [P('Drive type'), P('Transmission'), P('Battery / engine'), P('Range / economy')],
    },
    {
      title: 'Dimensions',
      items: [P('Length'), P('Width'), P('Height'), P('Wheelbase'), P('Kerb weight')],
    },
    {
      title: 'Materials',
      items: [P('Body panels'), P('Chassis'), P('Interior trim'), P('Glazing')],
    },
  ],
};
