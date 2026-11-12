#!/usr/bin/env python3
"""Printability report + 4-view preview PNG for a mesh (STL or OBJ; 3MF also needs networkx and lxml).

    python check.py part.stl [--out part.png] [--bed 330 320 325]
    python check.py --test
"""
import argparse
from pathlib import Path

import numpy as np
import trimesh

# H3C build volume: Bambu's spec page and the "Bambu Lab H3C 0.4 nozzle" preset agree.
BED = (330.0, 320.0, 325.0)
FACES = {"-Z (as modeled)": [0, 0, -1], "+Z": [0, 0, 1], "-X": [-1, 0, 0],
         "+X": [1, 0, 0], "-Y": [0, -1, 0], "+Y": [0, 1, 0]}


def overhang_mm2(mesh, limit_deg=45.0):
    """Down-facing area steeper than limit_deg from vertical, ignoring faces lying on the bed."""
    z = mesh.triangles[:, :, 2]
    on_bed = (z.max(axis=1) - mesh.bounds[0][2]) < 0.05
    steep = mesh.face_normals[:, 2] < -np.sin(np.radians(limit_deg))
    return float(mesh.area_faces[steep & ~on_bed].sum())


def orientations(mesh):
    """(overhang mm², height mm, face down) for each axis face down, best first."""
    rows = []
    for name, d in FACES.items():
        m = mesh.copy()
        m.apply_transform(trimesh.geometry.align_vectors(d, [0, 0, -1]))
        rows.append((round(overhang_mm2(m), 1), round(m.extents[2], 1), name))
    return sorted(rows)


def fits(ext, bed=BED):
    """Plate rotation in degrees at which the bounding box fits, or None."""
    x, y, z = ext
    if z > bed[2]:
        return None
    for deg in (0, 90, *range(5, 90, 5)):  # square first, then diagonal
        c, s = abs(np.cos(np.radians(deg))), abs(np.sin(np.radians(deg)))
        if x * c + y * s <= bed[0] and x * s + y * c <= bed[1]:
            return deg
    return None


VIEWS = [("iso", (1, -1, 0.8), None), ("front (X-Z)", (0, -1, 0), "XZ"),
         ("right (Y-Z)", (1, 0, 0), "YZ"), ("top (X-Y)", (0, 0, 1), "XY")]


def _camera(d):
    """Rows: screen-right, screen-up, toward-viewer."""
    d = np.asarray(d, float) / np.linalg.norm(d)
    r = np.cross([0, 1, 0] if abs(d[2]) > 0.99 else [0, 0, 1], d)
    r /= np.linalg.norm(r)
    return np.array([r, np.cross(d, r), d])


def rasterize(mesh, d, size=500):
    """Flat-shaded z-buffer image looking along -d. Returns (rgb, mm extent)."""
    cam = _camera(d)
    p = mesh.triangles @ cam.T
    lo, hi = p.reshape(-1, 3).min(0), p.reshape(-1, 3).max(0)
    s = (size - 1) / max(hi[:2] - lo[:2])
    xy = (p[:, :, :2] - lo[:2]) * s
    w, h = (np.ceil((hi[:2] - lo[:2]) * s) + 1).astype(int)
    zbuf, img = np.full((h, w), -np.inf), np.ones((h, w, 3))
    light = cam.T @ (np.array([0.4, 0.6, 1.0]) / np.linalg.norm([0.4, 0.6, 1.0]))
    shade = 0.25 + 0.75 * np.clip(mesh.face_normals @ light, 0, 1)
    # ponytail: one Python iteration per face; ~seconds at 100k faces, vectorize if it drags.
    for (a, b, c), z, sh in zip(xy, p[:, :, 2], shade):
        area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if abs(area) < 1e-12:
            continue
        x0, y0 = np.floor(np.min([a, b, c], 0)).astype(int)
        x1, y1 = np.minimum(np.ceil(np.max([a, b, c], 0)).astype(int), [w - 1, h - 1])
        X, Y = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        w0 = ((b[0] - X) * (c[1] - Y) - (b[1] - Y) * (c[0] - X)) / area
        w1 = ((c[0] - X) * (a[1] - Y) - (c[1] - Y) * (a[0] - X)) / area
        w2 = 1 - w0 - w1
        zz = w0 * z[0] + w1 * z[1] + w2 * z[2]
        m = (w0 >= -1e-9) & (w1 >= -1e-9) & (w2 >= -1e-9)
        m[m] = zz[m] > zbuf[Y[m], X[m]]
        zbuf[Y[m], X[m]] = zz[m]
        img[Y[m], X[m]] = sh * np.array([0.25, 0.55, 0.85])
    # Same-normal faces at different depths look identical: tint by depth, outline depth jumps.
    hit = np.isfinite(zbuf)
    z = np.where(hit, zbuf, zbuf[hit].min() - 1)
    t = (z - z.min()) / max(z.max() - z.min(), 1e-9)
    img[hit] *= (0.55 + 0.45 * t[hit])[:, None]
    gy, gx = np.gradient(z)
    img[np.hypot(gx, gy) > 4 / s] = 0.1
    return img, (lo[0], hi[0], lo[1], hi[1])


def render(mesh, out):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(2, 2, figsize=(10, 10))
    for ax, (name, d, labels) in zip(axes.flat, VIEWS):
        img, ext = rasterize(mesh, d)
        ax.imshow(img, origin="lower", extent=ext)
        ax.set_title(name)
        if labels:
            ax.set(xlabel=f"{labels[0]} mm", ylabel=f"{labels[1]} mm")
            ax.grid(alpha=0.3)
        else:
            ax.axis("off")
    x, y, z = mesh.extents
    fig.suptitle(f"{x:.1f} x {y:.1f} x {z:.1f} mm", fontsize=14)
    fig.tight_layout()
    fig.savefig(out, dpi=110)
    plt.close(fig)


def report(path, out, bed):
    mesh = trimesh.load(path, force="mesh")
    ext, vol, deg = mesh.extents, mesh.volume / 1000, fits(mesh.extents, bed)
    fit = "NO - split, reorient or scale" if deg is None else "YES" if deg in (0, 90) else f"YES, only turned ~{deg} deg on the plate"
    print(f"file        {path}")
    print(f"size        {ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.1f} mm   fits {bed[0]:g}x{bed[1]:g}x{bed[2]:g}: {fit}")
    if mesh.is_watertight:
        print(f"volume      {vol:.2f} cm3   solid-mass ceiling ~{vol * 1.25:.0f} g PLA/PETG "
              f"(~{vol * 1.05:.0f} g ASA/ABS); slicer gives the real number")
    else:
        print("volume      n/a: mesh is not watertight, fix the model before trusting any number")
    print(f"mesh        watertight={mesh.is_watertight}  bodies={mesh.body_count}  faces={len(mesh.faces)}")
    print("orientation overhang>45deg mm2 | height mm | face down")
    for area, h, name in orientations(mesh):
        print(f"            {area:>10.1f} | {h:>9.1f} | {name}")
    render(mesh, out)
    print(f"preview     {out}")


def _test():
    box = trimesh.creation.box((20, 20, 10))
    assert overhang_mm2(box) == 0, "flat bottom on the bed is not an overhang"
    stem = trimesh.creation.box((10, 10, 20))  # z -10..10
    cap = trimesh.creation.box((30, 10, 4))
    cap.apply_translation((0, 0, 12))  # z 10..14, sticks out 10 mm each side
    tee = trimesh.util.concatenate([stem, cap])
    assert abs(overhang_mm2(tee) - 300) < 1e-6, overhang_mm2(tee)
    best = orientations(tee)[0]
    assert best[0] == 0 and "Y" in best[2], best  # lying flat needs no support
    assert fits((300, 330, 100)) == 90 and fits((340, 340, 10)) is None and fits((10, 10, 400)) is None
    assert fits((400, 20, 10)) not in (None, 0, 90), "a long thin part fits diagonally"
    print("ok")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("mesh", nargs="?")
    p.add_argument("--out")
    p.add_argument("--bed", nargs=3, type=float, default=BED)
    p.add_argument("--test", action="store_true")
    a = p.parse_args()
    if a.test or not a.mesh:
        _test()
    else:
        report(a.mesh, a.out or str(Path(a.mesh).with_suffix(".png")), a.bed)
