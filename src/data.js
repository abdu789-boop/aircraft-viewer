// Aircraft specs are bundled; silhouettes are fetched on demand (they are the bulk of the data).
const modules = import.meta.glob('../data/aircraft/*.json', { eager: true })

export const AIRCRAFT = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.name.localeCompare(b.name))

export const BY_ID = Object.fromEntries(AIRCRAFT.map((a) => [a.id, a]))

export const CATEGORIES = [
  ['airliner', 'Airliners'],
  ['business-jet', 'Business jets'],
  ['general-aviation', 'General aviation'],
  ['fighter', 'Fighters'],
  ['bomber', 'Bombers'],
  ['transport', 'Transports'],
  ['reconnaissance', 'Reconnaissance'],
  ['helicopter', 'Helicopters'],
]

// Distinct, print-safe hues; overlays use multiply blending so overlaps darken.
export const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706']

const cache = {}
export function loadSilhouette(id) {
  if (!cache[id]) {
    cache[id] = fetch(`${import.meta.env.BASE_URL}silhouettes/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`No silhouette for ${id}`)
      return r.json()
    })
  }
  return cache[id]
}
