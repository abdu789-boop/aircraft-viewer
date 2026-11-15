#!/usr/bin/env python3
"""Build calibrated silhouette JSON for every aircraft listed in tools/sources.json.

For each view it renders the source drawing, extracts a filled silhouette (see trace.py),
normalises orientation (top & side views nose-left, front view as drawn) and scales the
outline into metres using the aircraft's real dimensions:
  top   -> bbox height = wingspan      side -> bbox width = length
  front -> bbox width  = wingspan
Output: public/silhouettes/<id>.json  {view: {d, w, h, ground_offset_m}} with coordinates
in metres, bbox origin at (0,0). Also prints the implied "other" dimension as a sanity check.

Usage: build.py [--src DIR] [id ...]     (default DIR: sources/drawings)
"""
import json, os, sys
import numpy as np
import cv2
sys.path.insert(0, os.path.dirname(__file__))
from trace import render, silhouette

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def orient(mask, nose=None, rotate=None):
    # top/side views: bring the nose to the left; front views: optional 90° rotation
    if rotate:
        return np.rot90(mask, -1 if rotate == 'cw' else 1)
    return {None: mask, 'left': mask,
            'right': mask[:, ::-1],
            'up': np.rot90(mask, 1),      # nose up -> rotate 90° CCW -> nose left
            'down': np.rot90(mask, -1)}[nose]

def mirror(mask, keep):
    """Mirror one half of a mask: 'top'/'bottom' of a nose-left view about the nose-tip row,
    'left'/'right' of a front view about the fin-tip column."""
    ys, xs = np.where(mask)
    if keep in ('left', 'right'):
        axis = int(round(np.mean(np.where(mask[ys.min():ys.min() + 5])[1])))
        if keep == 'left':
            half = mask[:, :axis + 1]
            return np.concatenate([half, half[:, -2::-1]], axis=1)
        half = mask[:, axis:]
        return np.concatenate([half[:, :0:-1], half], axis=1)
    axis = int(round(np.mean(np.where(mask[:, xs.min():xs.min() + 5])[0])))
    if keep == 'top':
        half = mask[:axis + 1]
        return np.concatenate([half, half[-2::-1]])
    half = mask[axis:]
    return np.concatenate([half[:0:-1], half])

def stretch(mask, base_length_m, plugs):
    """Insert fuselage plugs into a nose-left top/side mask. plugs = [[station, metres], ...]
    where station is the fraction of the original length (from the nose) at which the column
    is duplicated; the column there must cut only the fuselage."""
    ys, xs = np.where(mask)
    x0, pw = xs.min(), xs.max() - xs.min() + 1
    ppm = pw / base_length_m
    for frac, metres in sorted(plugs, reverse=True):
        c = x0 + int(frac * pw); n = int(round(metres * ppm))
        mask = np.concatenate([mask[:, :c], np.repeat(mask[:, c:c + 1], n, axis=1), mask[:, c:]], axis=1)
    return mask

def contours_to_path(mask, sx, sy, eps_px=1.2):
    """mask -> SVG path (evenodd) in metres, bbox origin at (0,0). sx/sy = metres per px."""
    m = np.ascontiguousarray(mask.astype(np.uint8) * 255)
    cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    ys, xs = np.where(mask)
    x0, y0 = xs.min(), ys.min()
    parts = []
    for c in cs:
        c = cv2.approxPolyDP(c, eps_px, True).reshape(-1, 2)
        if len(c) < 3:
            continue
        pts = [f'{(x - x0) * sx:.3f},{(y - y0) * sy:.3f}' for x, y in c]
        parts.append('M' + 'L'.join(pts) + 'Z')
    return ''.join(parts), (xs.max() - x0 + 1) * sx, (ys.max() - y0 + 1) * sy

def build(ac_id, src_dir, cfg):
    spec = json.load(open(f'{ROOT}/data/aircraft/{ac_id}.json'))['specs']
    out, scales = {}, {}
    for view, v in cfg['views'].items():
        g = render(os.path.join(src_dir, v.get('file', cfg['file'])), cfg.get('width', 4000))
        h, w = g.shape
        cx0, cy0, cx1, cy1 = v['crop']
        g = np.pad(g[int(cy0 * h):int(cy1 * h), int(cx0 * w):int(cx1 * w)], 4, constant_values=255)
        for ex0, ey0, ex1, ey1 in v.get('erase', []):  # whiten rectangles (fractions of the crop)
            gh, gw = g.shape
            g[int(ey0 * gh):int(ey1 * gh), int(ex0 * gw):int(ex1 * gw)] = 255
        if v.get('seal') == 'bottom':  # outline open at the crop's bottom edge: draw a closing line
            g[-5, :] = 0                 # (use ground: false with it, or the stripper erases it)
        mask = silhouette(g, v.get('threshold', cfg.get('threshold', 160)),
                          v.get('open', cfg.get('open', 2)), v.get('close', cfg.get('close', 0)),
                          v.get('gap', cfg.get('gap', 12)),
                          ground=v.get('ground', cfg.get('ground', view != 'top')),
                          ground_thick=v.get('ground_thick', cfg.get('ground_thick', 4)),
                          ground_frac=v.get('ground_frac', cfg.get('ground_frac', 0.12)), rotate=v.get('rotate'))
        if v.get('angle'):  # drawing not axis-aligned: rotate (degrees CCW) before orienting
            from scipy import ndimage as ndi
            mask = ndi.rotate(mask.astype(np.uint8), v['angle'], order=0, reshape=True).astype(bool)
        mask = orient(mask, v.get('nose'), v.get('rotate'))
        if v.get('mirror'):  # symmetric top view with one half polluted: mirror the clean half
            mask = mirror(mask, v['mirror'])
        st = v.get('stretch', cfg.get('stretch') if view != 'front' else None)
        if st:  # derive a stretched variant: insert straight fuselage plugs (nose-left mask)
            mask = stretch(mask, st['base_length_m'], st['plugs'])
        ys, xs = np.where(mask)
        pw, ph = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        # Each axis is scaled independently to the official dimension, so the overlay always
        # matches the spec sheet even when a drawing is a few percent off in one axis.
        # Gear-up drawings have no ground reference: scale uniformly and derive the ground offset.
        gear_up = v.get('gear') == 'up'
        if view == 'top':
            sx, sy, implied = spec['length_m'] / pw, spec['wingspan_m'] / ph, 'length'
        elif view == 'side':
            sx, sy, implied = spec['length_m'] / pw, spec['height_m'] / ph, 'height'
        else:
            sx, sy, implied = spec['wingspan_m'] / pw, spec['height_m'] / ph, 'height'
        if gear_up:
            sy = sx
        # Helicopter rotor views have no spec dimension to pin the bbox to (blades drawn at an
        # angle, or edge-on as a hairline): reuse another view's metres-per-pixel instead.
        if v.get('scale_from'):
            sx = sy = scales[v['scale_from']]
        scales[view] = sx
        d, wm, hm = contours_to_path(mask, sx, sy)
        ground = round(spec['height_m'] - hm, 3) if gear_up and view != 'top' else 0
        drawn = (pw if implied == 'length' else ph) * sx
        out[view] = {'d': d, 'w': round(wm, 3), 'h': round(hm, 3), 'ground_offset_m': ground}
        print(f'  {ac_id:10s} {view:5s} {wm:6.2f} x {hm:6.2f} m   drawing implied {implied} '
              f'{drawn:6.2f} m vs spec {spec[implied + "_m"]}  ground +{ground}  path {len(d)//1024} KB')
    os.makedirs(f'{ROOT}/public/silhouettes', exist_ok=True)
    json.dump(out, open(f'{ROOT}/public/silhouettes/{ac_id}.json', 'w'))

if __name__ == '__main__':
    args = sys.argv[1:]
    src_dir = f'{ROOT}/sources/drawings'
    if args[:1] == ['--src']:
        src_dir, args = args[1], args[2:]
    sources = json.load(open(f'{ROOT}/tools/sources.json'))
    ids = args or list(sources)
    for ac_id in ids:
        build(ac_id, src_dir, sources[ac_id])
