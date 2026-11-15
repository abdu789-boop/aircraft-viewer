// Spec rows: how each field is labelled, converted and formatted.
// metric/imperial: [unit label, multiplier from stored metric value]
const num = (key, label, metric, imperial, dp = 0, better = null, note) => ({
  key, label, metric, imperial, dp, better, type: 'number', note,
})
const text = (key, label) => ({ key, label, type: 'text' })

export const GROUPS = [
  { name: 'Dimensions', rows: [
    num('length_m', 'Length', ['m', 1], ['ft', 3.28084], 2),
    num('wingspan_m', 'Wingspan', ['m', 1], ['ft', 3.28084], 2),
    num('height_m', 'Height', ['m', 1], ['ft', 3.28084], 2),
    num('wing_area_m2', 'Wing area', ['m²', 1], ['ft²', 10.7639], 1),
  ]},
  { name: 'Weights', rows: [
    num('empty_weight_kg', 'Empty weight', ['kg', 1], ['lb', 2.20462]),
    num('mtow_kg', 'Max take-off weight', ['kg', 1], ['lb', 2.20462]),
  ]},
  { name: 'Performance', rows: [
    num('max_speed_kmh', 'Max speed', ['km/h', 1], ['mph', 0.621371], 0, 'high'),
    num('cruise_speed_kmh', 'Cruise speed', ['km/h', 1], ['mph', 0.621371], 0, 'high'),
    num('range_km', 'Range', ['km', 1], ['mi', 0.621371], 0, 'high'),
    num('ceiling_m', 'Service ceiling', ['m', 1], ['ft', 3.28084], 0, 'high'),
  ]},
  { name: 'Propulsion', rows: [
    num('engine_count', 'Engines', ['', 1], ['', 1]),
    text('engine_type', 'Engine'),
    num('thrust_kn_total', 'Total thrust', ['kN', 1], ['lbf', 224.809], 0, 'high'),
    num('power_kw_total', 'Total power', ['kW', 1], ['hp', 1.34102], 0, 'high'),
  ]},
  { name: 'Capacity', rows: [
    num('crew', 'Crew', ['', 1], ['', 1]),
    num('passengers', 'Passengers', ['', 1], ['', 1], 0, 'high'),
  ]},
  { name: 'Background', rows: [
    text('role', 'Role'),
    text('manufacturer', 'Manufacturer'),
    text('country', 'Country'),
    num('first_flight', 'First flight', ['', 1], ['', 1]),
    num('introduced', 'Introduced', ['', 1], ['', 1]),
    num('number_built', 'Number built', ['', 1], ['', 1]),
    num('unit_cost_usd_m', 'Unit cost', ['US$ M', 1], ['US$ M', 1], 1, 'low'),
  ]},
]

export function convert(row, value, units) {
  const [, k] = units === 'imperial' ? row.imperial : row.metric
  return value * k
}

export function unitLabel(row, units) {
  return (units === 'imperial' ? row.imperial : row.metric)[0]
}

const YEAR_KEYS = new Set(['first_flight', 'introduced'])

export function format(row, value, units) {
  if (value == null) return '—'
  if (row.type === 'text') return value
  if (YEAR_KEYS.has(row.key)) return String(value)
  const v = convert(row, value, units)
  return v.toLocaleString(undefined, { maximumFractionDigits: row.dp, minimumFractionDigits: v >= 100 ? 0 : row.dp })
}

// Length in the active unit system, for dimension callouts on the canvas.
export function fmtLength(m, units) {
  if (units === 'imperial') {
    const ft = m * 3.28084
    return ft >= 100 ? `${ft.toFixed(0)} ft` : `${ft.toFixed(1)} ft`
  }
  return m >= 100 ? `${m.toFixed(0)} m` : `${m.toFixed(1)} m`
}
