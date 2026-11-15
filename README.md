# Aircraft Viewer

Compare aircraft silhouettes to scale from the top, side and front, with specs side by side.
The idea is carsized.com, for aircraft.

## Run

```bash
npm install
npm run dev
```

Static site, no backend. `npm run build` produces `dist/` for any static host.

## How it works

- `data/aircraft/*.json` — one file per aircraft: specs (metric), notes on individual figures,
  and the attribution of the drawing its silhouette came from.
- `sources/drawings/` — the original three-view line drawings (see `sources/SOURCES.md`).
- `tools/trace.py` — renders a region of a drawing, flood-fills from outside to get a filled
  silhouette, strips hairlines (ground and dimension lines) and fragments of neighbouring views.
- `tools/build.py` + `tools/sources.json` — per aircraft and view: the crop box of that view in
  the drawing, nose direction, optional rotation, and gear state. Produces
  `public/silhouettes/<id>.json` with SVG paths **in metres**, nose-left for top and side views.
  Each axis is scaled independently to the official length / wingspan / height, so the overlay
  always matches the spec sheet even if a drawing is a few percent off. Gear-up drawings are
  scaled uniformly and given a ground offset so they sit at the right height.
- `src/Compare.jsx` — lays the paths out in a shared metre-based SVG viewBox: ground line at
  y = 0 for side and front views, alignment on nose / centre / tail, dimension callouts, a 1.8 m
  person and a scale bar. "Same length" mode scales every aircraft to the first one's length
  (or wingspan in the front view) to compare proportions instead of size.
- State (aircraft, view, alignment, mode, units) lives in the URL, so comparisons are shareable.

## Adding an aircraft

1. Find a three-view drawing on Wikimedia Commons (search `"<type> 3-view svg"`), check its
   licence, and save it to `sources/drawings/`. Add it to `sources/SOURCES.md`.
2. Create `data/aircraft/<id>.json` (copy an existing one).
3. Add an entry to `tools/sources.json`: for each view, the crop box as fractions of the
   rendered image (x0 y0 x1 y1), `nose` (`left|right|up|down`) for top/side views, `rotate`
   (`cw|ccw`) if the front view is drawn sideways, `gear: "up"` for in-flight drawings.
   `gap`, `open` and `threshold` tune the tracer if wheels detach or lines leak; `close` bridges
   gaps in the outline. Side and front views have long horizontal hairlines near the bottom
   (ground and dimension lines) erased before filling, so the pocket between belly, gear and
   ground is not filled; `ground: false` keeps them (e.g. helicopter skids); `ground_thick` raises the hairline limit (px at 4000 px width) for heavily drawn ground lines and `ground_frac` narrows the band scanned (fraction of the view height from the bottom). `erase: [[x0, y0, x1, y1], ...]` whitens rectangles of the crop (fractions) to drop stray dimension lines, and `seal: "bottom"` draws a closing line along the crop's bottom edge for outlines that are open there. `mirror: "top"|"bottom"` (or `"left"|"right"` for a front view) rebuilds a view from its clean half when the
   drawing's other half touches a neighbouring view. `angle` (degrees, counter-clockwise) straightens
   a view that is drawn at an angle before `nose`/`rotate` are applied. A view may name its own
   `file`. `stretch: {base_length_m, plugs: [[station, metres], ...]}` derives a stretched variant
   from a shorter one's drawing by duplicating fuselage columns at the given stations (fractions
   of the base length from the nose) in the top and side views; the front view is left alone.
   `scale_from: "side"` scales a view uniformly with another view's metres-per-pixel instead of
   its own spec dimension (helicopter top/front views, where the rotor sets the bbox).
4. Run `python3 -I tools/build.py <id>` and check the printed "drawing implied" dimensions
   against the spec; a big gap usually means a bad crop.

Python needs numpy, scipy, Pillow and opencv-python-headless, plus `rsvg-convert` on PATH.
