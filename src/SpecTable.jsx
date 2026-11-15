import React from 'react'
import { GROUPS, format, unitLabel } from './units.js'

export default function SpecTable({ items, units }) {
  if (!items.length) return null
  const ref = items[0].ac
  return (
    <div className="specs">
      <table>
        <thead>
          <tr>
            <th />
            {items.map(({ ac, color }) => (
              <th key={ac.id}><span className="dot" style={{ background: color }} />{ac.name}<small>{ac.variant}</small></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => {
            const rows = g.rows.filter((r) => items.some(({ ac }) => ac.specs[r.key] != null || ac[r.key] != null))
            if (!rows.length) return null
            return (
              <React.Fragment key={g.name}>
                <tr className="group"><th colSpan={items.length + 1}>{g.name}</th></tr>
                {rows.map((r) => {
                  const vals = items.map(({ ac }) => ac.specs[r.key] ?? ac[r.key] ?? null)
                  const nums = vals.filter((v) => typeof v === 'number')
                  const best = r.better && nums.length > 1 ? (r.better === 'high' ? Math.max(...nums) : Math.min(...nums)) : null
                  const unit = r.type === 'number' ? unitLabel(r, units) : ''
                  return (
                    <tr key={r.key}>
                      <th>{r.label}{unit && <small>{unit}</small>}</th>
                      {vals.map((v, i) => {
                        const ac = items[i].ac
                        const note = ac.notes?.[r.key]
                        const refV = vals[0]
                        const delta = i > 0 && typeof v === 'number' && typeof refV === 'number' && refV && r.type === 'number' && !['first_flight', 'introduced'].includes(r.key)
                          ? ((v - refV) / refV) * 100 : null
                        return (
                          <td key={ac.id} className={v === best ? 'best' : ''} title={note || ''}>
                            {format(r, v, units)}{note && <sup>*</sup>}
                            {delta != null && Math.abs(delta) >= 0.5 && (
                              <span className={'delta ' + (delta > 0 ? 'up' : 'down')}>{delta > 0 ? '+' : ''}{delta.toFixed(0)}%</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
      <p className="hint">Percentages are relative to {ref.name}. * hover for a note on that figure.</p>
      <details className="sources">
        <summary>Drawing sources</summary>
        <ul>
          {items.map(({ ac }) => (
            <li key={ac.id}><a href={ac.drawing.url} target="_blank" rel="noreferrer">{ac.drawing.title}</a> — {ac.drawing.author}, {ac.drawing.license}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
