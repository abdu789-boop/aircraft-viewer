import React, { useEffect, useMemo, useState } from 'react'
import { BY_ID, COLORS, loadSilhouette } from './data.js'
import Picker from './Picker.jsx'
import Compare from './Compare.jsx'
import SpecTable from './SpecTable.jsx'

const MAX = 4
const VIEWS = [['top', 'Top'], ['side', 'Side'], ['front', 'Front']]
const ALIGNS = [['nose', 'Nose'], ['center', 'Centre'], ['tail', 'Tail']]

function readUrl() {
  const p = new URLSearchParams(location.search)
  const ids = (p.has('a') ? p.get('a') : 'a380,f16c').split(',').filter((id) => BY_ID[id]).slice(0, MAX)
  return {
    ids,
    view: VIEWS.some(([v]) => v === p.get('view')) ? p.get('view') : 'side',
    align: ALIGNS.some(([a]) => a === p.get('align')) ? p.get('align') : 'nose',
    mode: p.get('mode') === 'proportion' ? 'proportion' : 'scale',
    units: p.get('units') === 'imperial' ? 'imperial' : 'metric',
  }
}

export default function App() {
  const [state, setState] = useState(readUrl)
  const [sils, setSils] = useState({})
  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('a', state.ids.join(','))
    p.set('view', state.view); p.set('align', state.align)
    if (state.mode !== 'scale') p.set('mode', state.mode)
    if (state.units !== 'metric') p.set('units', state.units)
    history.replaceState(null, '', `?${p}`)
  }, [state])

  useEffect(() => {
    state.ids.forEach((id) => {
      if (sils[id]) return
      loadSilhouette(id).then((s) => setSils((prev) => ({ ...prev, [id]: s }))).catch(console.error)
    })
  }, [state.ids])

  const [showPerson, setShowPerson] = useState(true)
  const [showDims, setShowDims] = useState(true)

  const items = useMemo(() =>
    state.ids.map((id, i) => ({ ac: BY_ID[id], sil: sils[id], color: COLORS[i] })).filter((it) => it.sil),
    [state.ids, sils])

  const toggle = (id) => set({
    ids: state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id].slice(0, MAX),
  })

  return (
    <div className="app">
      <header>
        <h1>Aircraft Viewer</h1>
        <p>Compare aircraft silhouettes to scale, like carsized does for cars.</p>
      </header>
      <Picker selected={state.ids} onToggle={toggle} max={MAX} />
      <main>
        <div className="toolbar">
          <Seg label="View" value={state.view} options={VIEWS} onChange={(view) => set({ view })} />
          {state.view !== 'front' && <Seg label="Align" value={state.align} options={ALIGNS} onChange={(align) => set({ align })} />}
          <Seg label="Size" value={state.mode} options={[['scale', 'True scale'], ['proportion', 'Same length']]} onChange={(mode) => set({ mode })} />
          <Seg label="Units" value={state.units} options={[['metric', 'Metric'], ['imperial', 'Imperial']]} onChange={(units) => set({ units })} />
          <label className="check"><input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} /> Dimensions</label>
          <label className="check"><input type="checkbox" checked={showPerson} onChange={(e) => setShowPerson(e.target.checked)} /> Person</label>
        </div>
        <div className="legend">
          {state.ids.map((id, i) => (
            <button key={id} className="tag" style={{ '--c': COLORS[i] }} onClick={() => toggle(id)} title="Remove">
              {BY_ID[id].name} ×
            </button>
          ))}
          {state.ids.length > 0 && (
            <button className="tag clear" onClick={() => set({ ids: [] })} title="Remove all aircraft">Clear</button>
          )}
        </div>
        <Compare items={items} view={state.view} align={state.align} mode={state.mode} units={state.units}
          showPerson={showPerson} showDims={showDims} />
        <SpecTable items={items} units={state.units} />
      </main>
    </div>
  )
}

function Seg({ label, value, options, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <span>{label}</span>
      {options.map(([v, text]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}
