#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Headless MakeHuman geometry oracle.

Drives MakeHuman's real macro + modifier pipeline with NO Qt/OpenGL (numpy only),
applies a config of macro + feature-modifier values, and writes ground-truth
artifacts we validate our JS port against:

  <out>.obj          body-group mesh (quads, with UVs)
  <out>.coords.f32   full 19158x3 float32 vertex buffer (exact compare)
  <out>.details.json targetsDetailStack  { targetPath: weight }
  <out>.macro.json   every human.*Val + raw macro slider values
  <out>.meta.json    vertex/face counts, bbox, body vertex index range

Usage:
  python mh_export.py <config.json> <out_prefix> [--subdivide]

config.json:
  {
    "macro": { "gender":0.0, "age":0.5, "asian":1.0, "caucasian":0.0, "african":0.0,
               "muscle":0.5, "weight":0.5, "height":0.5, "proportions":0.5 },
    "modifiers": { "nose/nose-nostrils-width-decr|incr": -0.3, ... }
  }
All keys optional; sensible young-asian-female defaults are applied.
"""
import sys, os, json

HERE = os.path.dirname(os.path.abspath(__file__))
MH = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..",
                                   ".references", "makehuman", "makehuman"))
os.chdir(MH)
for p in ["./lib", "./apps", "./shared", "./apps/gui", "./core", "./"]:
    ap = os.path.abspath(p)
    if ap not in sys.path:
        sys.path.insert(0, ap)

import numpy as np
import getpath
from core import G
import types
G.app = types.SimpleNamespace(progress=None, selectedHuman=None, events=[],
                              settings={}, addLogMessage=lambda *a, **k: None)

import files3d
from human import Human
import humanmodifier


def build_human():
    base = files3d.loadMesh(getpath.getSysDataPath("3dobjs/base.obj"))
    human = Human(base)
    humanmodifier.loadModifiers(getpath.getSysDataPath('modifiers/modeling_modifiers.json'), human)
    return human


def apply_config(human, cfg):
    m = cfg.get("macro", {})
    # Macro defaults: young adult asian female, average everything.
    human.setGender(m.get("gender", 0.0))
    human.setAge(m.get("age", 0.5))
    human.setMuscle(m.get("muscle", 0.5))
    human.setWeight(m.get("weight", 0.5))
    human.setHeight(m.get("height", 0.5))
    human.setBodyProportions(m.get("proportions", 0.5))
    # Race (ethnic trio auto-normalises to sum 1)
    human.setCaucasian(m.get("caucasian", 0.0), sync=False)
    human.setAfrican(m.get("african", 0.0), sync=False)
    human.setAsian(m.get("asian", 1.0), sync=True)

    # Feature modifiers by fullName.
    for full, val in cfg.get("modifiers", {}).items():
        mod = human.getModifier(full)
        if mod is None:
            print("WARN unknown modifier:", full)
            continue
        mod.setValue(val)

    human.applyAllTargets()


def dump_vals(human):
    keys = ["gender", "age", "weight", "muscle", "height", "bodyProportions",
            "breastSize", "breastFirmness",
            "maleVal", "femaleVal", "babyVal", "childVal", "youngVal", "oldVal",
            "minweightVal", "averageweightVal", "maxweightVal",
            "minmuscleVal", "averagemuscleVal", "maxmuscleVal",
            "minheightVal", "averageheightVal", "maxheightVal",
            "caucasianVal", "asianVal", "africanVal",
            "uncommonproportionsVal", "regularproportionsVal", "idealproportionsVal",
            "mincupVal", "averagecupVal", "maxcupVal",
            "minfirmnessVal", "averagefirmnessVal", "maxfirmnessVal"]
    out = {}
    for k in keys:
        if hasattr(human, k):
            out[k] = float(getattr(human, k))
    return out


def body_face_mask(mesh):
    # mesh.group: per-face group index; _faceGroups[i].name
    names = {g.idx: g.name for g in mesh._faceGroups}
    grp = np.asarray(mesh.group)
    mask = np.array([names.get(int(g), "").startswith("body") for g in grp])
    return mask


def write_obj(path, mesh, face_mask):
    coord = mesh.coord
    fvert = mesh.fvert[face_mask]
    fuvs = mesh.fuvs[face_mask] if getattr(mesh, "fuvs", None) is not None and len(mesh.fuvs) else None
    texco = mesh.texco
    with open(path, "w") as f:
        f.write("# MakeHuman headless oracle export\n")
        for v in coord:
            f.write("v %.6f %.6f %.6f\n" % (v[0], v[1], v[2]))
        if texco is not None and len(texco):
            for t in texco:
                f.write("vt %.6f %.6f\n" % (t[0], t[1]))
        for i, face in enumerate(fvert):
            if fuvs is not None:
                uv = fuvs[i]
                f.write("f " + " ".join("%d/%d" % (face[k] + 1, uv[k] + 1) for k in range(len(face))) + "\n")
            else:
                f.write("f " + " ".join("%d" % (face[k] + 1) for k in range(len(face))) + "\n")


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    cfg_path, out = sys.argv[1], sys.argv[2]
    subdivide = "--subdivide" in sys.argv[3:]
    cfg = json.load(open(cfg_path, "r", encoding="utf-8"))

    human = build_human()
    apply_config(human, cfg)

    mesh = human.meshData
    if subdivide:
        human.setSubdivided(True)
        mesh = human.getSubdivisionMesh() if hasattr(human, "getSubdivisionMesh") else human.meshData

    coord = np.asarray(mesh.coord, dtype=np.float32)
    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)

    mask = body_face_mask(mesh)
    write_obj(out + ".obj", mesh, mask)
    coord.tofile(out + ".coords.f32")

    json.dump(dict(human.targetsDetailStack), open(out + ".details.json", "w"), indent=1)
    json.dump(dump_vals(human), open(out + ".macro.json", "w"), indent=1)

    bodyverts = np.unique(mesh.fvert[mask])
    meta = {
        "vertexCount": int(len(coord)),
        "faceCount": int(mask.sum()),
        "bboxMin": [float(x) for x in coord.min(0)],
        "bboxMax": [float(x) for x in coord.max(0)],
        "bodyVertMin": int(bodyverts.min()),
        "bodyVertMax": int(bodyverts.max()),
        "bodyVertCount": int(len(bodyverts)),
        "subdivided": bool(subdivide),
        "config": cfg,
    }
    json.dump(meta, open(out + ".meta.json", "w"), indent=1)
    print("WROTE", out + ".obj", "| faces", meta["faceCount"],
          "| bbox", meta["bboxMin"], meta["bboxMax"])
    print("detail targets:", len(human.targetsDetailStack))


if __name__ == "__main__":
    main()
