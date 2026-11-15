import React, { useState } from 'react'
import { AIRCRAFT, CATEGORIES, COLORS } from './data.js'

export default function Picker({ selected, onToggle, max }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const needle = q.trim().toLowerCase()
  const list = AIRCRAFT.filter((a) =>
    (!cat || a.category === cat) &&
    (!needle || `${a.name} ${a.manufacturer} ${a.role}`.toLowerCase().includes(needle)))
  const present = new Set(AIRCRAFT.map((a) => a.category))

  return (
    <aside className="picker">
      <input className="search" type="search" placeholder="Search aircraft…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button className={!cat ? 'chip on' : 'chip'} onClick={() => setCat('')}>All</button>
        {CATEGORIES.filter(([k]) => present.has(k)).map(([k, label]) => (
          <button key={k} className={cat === k ? 'chip on' : 'chip'} onClick={() => setCat(k)}>{label}</button>
        ))}
      </div>
      <ul className="list">
        {list.map((a) => {
          const i = selected.indexOf(a.id)
          const full = i < 0 && selected.length >= max
          return (
            <li key={a.id}>
              <button className={i >= 0 ? 'item on' : 'item'} disabled={full} onClick={() => onToggle(a.id)}>
                <span className="swatch" style={{ background: i >= 0 ? COLORS[i] : 'transparent' }} />
                <span className="name">{a.name}</span>
                <span className="meta">{a.manufacturer} · {a.specs.length_m} m</span>
              </button>
            </li>
          )
        })}
        {!list.length && <li className="none">No matches.</li>}
      </ul>
      <p className="hint">Select up to {max}. Click again to remove.</p>
    </aside>
  )
}
