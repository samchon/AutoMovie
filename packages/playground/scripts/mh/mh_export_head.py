#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Export a head render OBJ from the real MakeHuman pipeline (macro+modifier+Catmull-Clark).

Writes a single OBJ with two material groups:
  usemtl skin  -> subdivided 'body' faces, cropped to the head/neck (vert y > CROP)
  usemtl eye   -> 'helper-l-eye' + 'helper-r-eye' eyeball spheres (subdivided, follow morphs)

Usage: python mh_export_head.py <config.json> <out.obj> [--cropY 4.6]
"""
import sys, os, json
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MH = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..",
                                   ".references", "makehuman", "makehuman"))
os.chdir(MH)
for p in ["./lib", "./apps", "./shared", "./apps/gui", "./core", "./"]:
    ap = os.path.abspath(p)
    if ap not in sys.path:
        sys.path.insert(0, ap)

import getpath, types
from core import G
G.app = types.SimpleNamespace(progress=None, selectedHuman=None, events=[],
                              settings={}, addLogMessage=lambda *a, **k: None)
import files3d
from human import Human
import humanmodifier
import catmull_clark_subdivision as ccs
# reuse the config application
sys.path.insert(0, HERE)
from mh_export import apply_config  # noqa


def group_face_mask(mesh, names_wanted):
    gids = [g.idx for g in mesh._faceGroups if g.name in names_wanted]
    return np.isin(np.asarray(mesh.group), gids)


def main():
    cfg_path, out = sys.argv[1], sys.argv[2]
    cropY = 4.6
    if "--cropY" in sys.argv:
        cropY = float(sys.argv[sys.argv.index("--cropY") + 1])
    cfg = json.load(open(cfg_path, "r", encoding="utf-8"))

    base = files3d.loadMesh(getpath.getSysDataPath("3dobjs/base.obj"))
    human = Human(base)
    humanmodifier.loadModifiers(getpath.getSysDataPath('modifiers/modeling_modifiers.json'), human)
    apply_config(human, cfg)

    sub = ccs.createSubdivisionObject(human.meshData)
    sub.calcNormals()
    coord = np.asarray(sub.coord, dtype=np.float64)
    texco = np.asarray(sub.texco)
    vnorm = np.asarray(sub.vnorm, dtype=np.float64)
    fvert = np.asarray(sub.fvert)
    fuvs = np.asarray(sub.fuvs)

    skin_mask = group_face_mask(sub, {"body"})
    # crop body to head/neck: keep faces whose every vertex is above cropY
    yv = coord[:, 1]
    face_minY = yv[fvert].min(axis=1)
    skin_mask = skin_mask & (face_minY > cropY)
    eye_mask = group_face_mask(sub, {"helper-l-eye", "helper-r-eye"})

    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        f.write("# MakeHuman head render export (subdivided, with normals)\n")
        for v in coord:
            f.write("v %.6f %.6f %.6f\n" % (v[0], v[1], v[2]))
        for t in texco:
            f.write("vt %.6f %.6f\n" % (t[0], t[1]))
        for n in vnorm:
            f.write("vn %.5f %.5f %.5f\n" % (n[0], n[1], n[2]))

        def emit(mask, mtl):
            f.write("usemtl %s\n" % mtl)
            fv = fvert[mask]
            fu = fuvs[mask]
            for i in range(len(fv)):
                face, uv = fv[i], fu[i]
                f.write("f " + " ".join("%d/%d/%d" % (face[k] + 1, uv[k] + 1, face[k] + 1) for k in range(len(face))) + "\n")

        emit(skin_mask, "skin")
        emit(eye_mask, "eye")

    # eye centers (for iris placement in the viewer)
    meta = {"cropY": cropY}
    for side, gname in (("l", "helper-l-eye"), ("r", "helper-r-eye")):
        gids = [g.idx for g in sub._faceGroups if g.name == gname]
        vmask = np.unique(fvert[np.isin(np.asarray(sub.group), gids)])
        c = coord[vmask]
        meta[side + "EyeCenter"] = [float(x) for x in c.mean(0)]
        meta[side + "EyeR"] = float(((c - c.mean(0)) ** 2).sum(1).max() ** 0.5)
    # head center / size for camera framing
    hv = np.unique(fvert[skin_mask])
    hc = coord[hv]
    meta["headCenter"] = [float(x) for x in hc.mean(0)]
    meta["headMin"] = [float(x) for x in hc.min(0)]
    meta["headMax"] = [float(x) for x in hc.max(0)]
    json.dump(meta, open(out.replace(".obj", ".meta.json"), "w"), indent=1)
    print("WROTE", out, "| skin faces", int(skin_mask.sum()), "| eye faces", int(eye_mask.sum()))
    print("meta", json.dumps(meta))


if __name__ == "__main__":
    main()
