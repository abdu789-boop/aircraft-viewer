#!/usr/bin/env python3
"""Turn a region of a 3-view line drawing into a filled silhouette mask.

Usage: trace.py INPUT.(svg|png) OUT.pbm --crop x0 y0 x1 y1 [--width W] [--open N] [--threshold T]
  crop is given as fractions (0..1) of the rendered image.
Writes a PBM (black = silhouette) suitable for potrace, plus OUT.png preview.
"""
import argparse, subprocess, sys, tempfile, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def render(path, width):
    if path.lower().endswith('.svg'):
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False).name
        subprocess.run(['rsvg-convert', '-w', str(width), '-b', 'white', path, '-o', tmp], check=True)
        img = Image.open(tmp).convert('L'); os.unlink(tmp)
    else:
        img = Image.open(path).convert('RGBA')
        bg = Image.new('RGBA', img.size, 'white'); bg.alpha_composite(img)
        img = bg.convert('L')
        if img.width != width:
            img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    return np.asarray(img)

def strip_ground(ink, frac=0.12, min_run=0.3, max_thick=4):
    """Erase long horizontal hairlines (ground line, dimension lines) in the bottom part of the
    ink bbox, except where they meet thicker ink (wheels), so that the pocket between the
    fuselage belly, the undercarriage and the ground line is not enclosed and flood-filled."""
    ys, xs = np.where(ink)
    if not len(ys):
        return ink
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    ink = ink.copy()
    thick = ndi.uniform_filter1d(ink.astype(np.float32), 2 * max_thick + 1, axis=0) * (2 * max_thick + 1)
    for y in range(max(y0, int(y1 - frac * (y1 - y0))), y1 + 1):
        row = ink[y]
        if row.sum() > min_run * (x1 - x0):  # a (possibly dashed) line across most of the view
            cols = np.where(row)[0]
            ink[y, cols[thick[y, cols] <= max_thick]] = False
    return ink

def silhouette(gray, threshold, open_px, close_px, gap, ground=True, ground_thick=4, ground_frac=0.12, rotate=None):
    ink = gray < threshold
    if ground:  # the ground line is at the bottom, or at a side for views drawn sideways
        if rotate == 'ccw':    # left edge becomes the bottom after rotation
            ink = strip_ground(ink.T[::-1], frac=ground_frac, max_thick=ground_thick)[::-1].T
        elif rotate == 'cw':   # right edge becomes the bottom
            ink = strip_ground(ink.T, frac=ground_frac, max_thick=ground_thick).T
        else:
            ink = strip_ground(ink, frac=ground_frac, max_thick=ground_thick)
    if close_px:  # bridge small gaps in the outline before flood filling
        ink = ndi.binary_dilation(ink, iterations=close_px)
    labels, n = ndi.label(~ink)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    border.discard(0)
    outside = np.isin(labels, list(border))
    mask = ~outside
    if close_px:
        mask = ndi.binary_erosion(mask, iterations=close_px, border_value=1)
    if open_px:  # strip hairlines (ground lines, dimension lines)
        mask = ndi.binary_opening(mask, iterations=open_px)
    # keep the largest component plus anything within `gap` px of it (wheels, pitot tubes),
    # dropping fragments of neighbouring views that strayed into the crop
    labels, n = ndi.label(mask)
    if n > 1:
        sizes = ndi.sum(mask, labels, range(1, n + 1))
        main = labels == (int(np.argmax(sizes)) + 1)
        near = ndi.binary_dilation(main, iterations=gap)
        keep = [i + 1 for i in range(n) if np.any(near & (labels == i + 1))]
        mask = np.isin(labels, keep)
    return mask

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input'); ap.add_argument('out')
    ap.add_argument('--crop', nargs=4, type=float, required=True)
    ap.add_argument('--width', type=int, default=4000)
    ap.add_argument('--threshold', type=int, default=160)
    ap.add_argument('--open', type=int, default=2)
    ap.add_argument('--close', type=int, default=0)
    ap.add_argument('--gap', type=int, default=12)
    ap.add_argument('--keep-ground', action='store_true')
    a = ap.parse_args()
    g = render(a.input, a.width)
    h, w = g.shape
    x0, y0, x1, y1 = a.crop
    g = g[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    g = np.pad(g, 4, constant_values=255)
    mask = silhouette(g, a.threshold, a.open, a.close, a.gap, not a.keep_ground)
    ys, xs = np.where(mask)
    print(f'{a.out}: bbox px w={xs.max()-xs.min()+1} h={ys.max()-ys.min()+1} (render {w}x{h})')
    Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).save(a.out)
    Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).save(a.out.rsplit('.', 1)[0] + '.png')

if __name__ == '__main__':
    main()
