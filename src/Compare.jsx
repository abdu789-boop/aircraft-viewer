import React, { useMemo } from 'react'
import { fmtLength } from './units.js'

// All geometry is in metres. SVG y points down; for side/front views the ground is y = 0.
// Top and side views are nose-left (normalised at build time).

function place(items, view, align, mode) {
  const ref = items[0].sil[view]
  return items.map(({ ac, sil, color }) => {
    const v = sil[view]
    // "proportions" mode scales everything to the first aircraft's length (or span, front view)
    const k = mode === 'proportion' ? ref.w / v.w : 1
    const w = v.w * k, h = v.h * k, g = v.ground_offset_m * k
    let x, y
    if (view === 'front') { x = -w / 2; y = -(h + g) }
    else {
      x = align === 'nose' ? 0 : align === 'tail' ? -w : -w / 2
      y = view === 'side' ? -(h + g) : -h / 2
    }
    return { ac, color, d: v.d, x, y, w, h, k }
  })
}

function Person({ x, size }) {
  // 1.8 m standing figure, feet at (x, 0)
  return (
    <g transform={`translate(${x} 0)`} fill="var(--ink)" opacity="0.85">
      <circle cx="0" cy="-1.63" r="0.14" />
      <path d="M-0.16,-1.42 h0.32 l0.06,0.72 h-0.08 l0.03,0.7 h-0.1 l-0.07,-0.6 l-0.07,0.6 h-0.1 l0.03,-0.7 h-0.08 z" />
      {size > 20 ? null : <text x="0" y="0.35" fontSize={size * 0.025} textAnchor="middle" fill="var(--ink)">1.8 m</text>}
    </g>
  )
}

function Dim({ x1, y1, x2, y2, label, color, fs, vertical }) {
  const tick = fs * 0.5
  return (
    <g stroke={color} fill={color} strokeWidth={fs * 0.06}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} />
          <text x={x1 - tick * 0.6} y={(y1 + y2) / 2} fontSize={fs} stroke="none" textAnchor="middle"
            transform={`rotate(-90 ${x1 - tick * 0.6} ${(y1 + y2) / 2})`}>{label}</text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} />
          <text x={(x1 + x2) / 2} y={y1 - tick * 0.6} fontSize={fs} stroke="none" textAnchor="middle">{label}</text>
        </>
      )}
    </g>
  )
}

export default function Compare({ items, view, align, mode, units, showPerson, showDims }) {
  const scene = useMemo(() => {
    if (!items.length) return null
    const placed = place(items, view, align, mode)
    let x0 = Math.min(...placed.map((p) => p.x)), x1 = Math.max(...placed.map((p) => p.x + p.w))
    let y0 = Math.min(...placed.map((p) => p.y)), y1 = Math.max(...placed.map((p) => p.y + p.h))
    if (view !== 'top') y1 = Math.max(y1, 0)
    const span = Math.max(x1 - x0, y1 - y0)
    const fs = span * 0.03              // label font size, in metres
    const step = fs * 1.6               // spacing between stacked dimension lines
    const dims = []
    if (showDims) {
      placed.forEach((p, i) => {
        const yBelow = (view === 'top' ? y1 : 0) + step * (i + 1.2)
        const xRight = x1 + step * (i + 1)
        const horiz = view === 'front' ? p.ac.specs.wingspan_m : p.ac.specs.length_m
        const vert = view === 'top' ? p.ac.specs.wingspan_m : p.ac.specs.height_m
        dims.push({ x1: p.x, y1: yBelow, x2: p.x + p.w, y2: yBelow, label: fmtLength(horiz * p.k, units), color: p.color })
        dims.push({ x1: xRight, y1: p.y, x2: xRight, y2: p.y + p.h, label: fmtLength(vert * p.k, units), color: p.color, vertical: true })
      })
      y1 += step * (placed.length + 1.5)
      x1 += step * (placed.length + 1)
    }
    const personX = x1 + fs
    if (showPerson && view !== 'top') { x1 = personX + fs * 2; y0 = Math.min(y0, -2) }
    const pad = span * 0.05
    return { placed, dims, fs, personX, vb: [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad], span }
  }, [items, view, align, mode, units, showPerson, showDims])

  if (!scene) return <div className="canvas empty">Pick one or more aircraft to compare.</div>

  const { placed, dims, fs, vb, personX, span } = scene
  const stroke = span * 0.0015
  return (
    <svg className="canvas" viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid meet">
      {view !== 'top' && (
        <line x1={vb[0]} y1="0" x2={vb[0] + vb[2]} y2="0" stroke="var(--ink)" strokeWidth={stroke * 2} strokeDasharray={`${fs * 0.6} ${fs * 0.4}`} />
      )}
      {placed.map((p) => (
        <path key={p.ac.id} d={p.d} transform={`translate(${p.x} ${p.y}) scale(${p.k})`}
          fill={p.color} fillOpacity="0.45" fillRule="evenodd" stroke={p.color} strokeWidth={stroke / p.k}
          style={{ mixBlendMode: 'multiply' }}>
          <title>{p.ac.name}</title>
        </path>
      ))}
      {dims.map((d, i) => <Dim key={i} {...d} fs={fs} />)}
      {showPerson && view !== 'top' && <Person x={personX} size={span} />}
      {/* scale bar */}
      {mode === 'scale' && (() => {
        const bar = span > 60 ? 20 : span > 15 ? 10 : 2
        const bx = vb[0] + fs, by = vb[1] + vb[3] - fs
        return (
          <g stroke="var(--ink)" fill="var(--ink)" strokeWidth={stroke * 2}>
            <line x1={bx} y1={by} x2={bx + bar} y2={by} />
            <line x1={bx} y1={by - fs * 0.3} x2={bx} y2={by + fs * 0.3} />
            <line x1={bx + bar} y1={by - fs * 0.3} x2={bx + bar} y2={by + fs * 0.3} />
            <text x={bx + bar / 2} y={by - fs * 0.4} fontSize={fs * 0.9} stroke="none" textAnchor="middle">{fmtLength(bar, units)}</text>
          </g>
        )
      })()}
    </svg>
  )
}
