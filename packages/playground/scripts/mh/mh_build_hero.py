#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Assemble a hero entirely with MakeHuman's own code + real assets, and export it.

Uses MakeHuman headless to: morph the body (macro+modifiers), Catmull-Clark
subdivide the skin, and fit REAL MakeHuman proxies (hair + eyes) to the morphed
body via MakeHuman's proxy code. Exports OBJ + MTL referencing MakeHuman's real
textures (young_asian_female skin, the hair diffuse, brown_eye), so the result
is a genuine MakeHuman character.

Usage: python mh_build_hero.py <config.json> <out.obj> [--hair long01] [--cropY auto]
config.json may also carry "hair": "<style>" and "skin": "<mhmat-relpath>".
"""
import sys, os, json, shutil
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
import proxy as proxymod
sys.path.insert(0, HERE)
from mh_export import apply_config  # noqa


def fit_proxy(human, mhclo, ptype):
    px = proxymod.loadProxy(human, mhclo, type=ptype)
    if px is None:
        return None
    px.loadMeshAndObject(human)
    coords = px.getCoords()           # fitted to the morphed body
    mesh = px.getMesh()
    return coords, np.asarray(mesh.fvert), np.asarray(mesh.texco), np.asarray(mesh.fuvs)


def main():
    cfg_path, out = sys.argv[1], sys.argv[2]
    cfg = json.load(open(cfg_path, "r", encoding="utf-8"))
    hair = cfg.get("hair", "long01")
    if "--hair" in sys.argv:
        hair = sys.argv[sys.argv.index("--hair") + 1]
    skin_rel = cfg.get("skin", "skins/young_asian_female/young_asian_female.mhmat")

    base = files3d.loadMesh(getpath.getSysDataPath("3dobjs/base.obj"))
    human = Human(base)
    humanmodifier.loadModifiers(getpath.getSysDataPath('modifiers/modeling_modifiers.json'), human)
    apply_config(human, cfg)
    G.app.selectedHuman = human

    # --- subdivided skin (body group, cropped to head/neck) ---
    sub = ccs.createSubdivisionObject(human.meshData)
    sub.calcNormals()
    coord = np.asarray(sub.coord, np.float64)
    texco = np.asarray(sub.texco)
    vnorm = np.asarray(sub.vnorm, np.float64)
    fvert = np.asarray(sub.fvert)
    fuvs = np.asarray(sub.fuvs)
    names = {g.idx: g.name for g in sub._faceGroups}
    grp = np.asarray(sub.group)
    body_all = np.array([names.get(int(g), "").startswith("body") for g in grp])
    eyeids = [g.idx for g in sub._faceGroups if g.name in ("helper-l-eye", "helper-r-eye")]
    eyeY = float(coord[np.unique(fvert[np.isin(grp, eyeids)]), 1].mean())
    cropY = eyeY - 1.6
    face_minY = coord[:, 1][fvert].min(axis=1)
    skin_mask = body_all & (face_minY > cropY)

    # --- real MakeHuman proxies fitted to the morphed body ---
    hair_mhclo = getpath.getSysDataPath("hair/%s/%s.mhclo" % (hair, hair))
    eyes_mhclo = getpath.getSysDataPath("eyes/low-poly/low-poly.mhclo")
    hairfit = fit_proxy(human, hair_mhclo, "Hair") if os.path.isfile(hair_mhclo) else None
    eyesfit = fit_proxy(human, eyes_mhclo, "Eyes") if os.path.isfile(eyes_mhclo) else None
    print("hair fitted:", hairfit is not None, "| eyes fitted:", eyesfit is not None)

    out = os.path.abspath(out)
    outdir = os.path.dirname(out)
    os.makedirs(outdir, exist_ok=True)
    texdir = os.path.join(outdir, "tex")
    os.makedirs(texdir, exist_ok=True)

    # resolve + copy textures referenced by the mhmats
    def copytex(src, dst):
        if src and os.path.isfile(src):
            shutil.copy(src, os.path.join(texdir, dst)); return "tex/" + dst
        return None
    skin_tex = copytex(getpath.getSysDataPath("skins/textures/young_lightskinned_female_diffuse3.png"), "skin.png")
    hair_tex = copytex(getpath.getSysDataPath("hair/%s/%s_diffuse.png" % (hair, hair)), "hair.png")
    eye_tex = copytex(getpath.getSysDataPath("eyes/materials/brown_eye.png"), "eye.png")

    base_obj = os.path.basename(out)
    mtl_name = base_obj.replace(".obj", ".mtl")
    with open(out, "w") as f:
        f.write("mtllib %s\n" % mtl_name)
        vbase = 0; tbase = 0

        def emit_block(name, verts, faces, uvs, uvcoords, mtl):
            nonlocal vbase, tbase
            for v in verts:
                f.write("v %.6f %.6f %.6f\n" % (v[0], v[1], v[2]))
            for t in uvcoords:
                f.write("vt %.6f %.6f\n" % (t[0], t[1]))
            f.write("o %s\nusemtl %s\n" % (name, mtl))
            for fi in range(len(faces)):
                face, uv = faces[fi], uvs[fi]
                f.write("f " + " ".join("%d/%d" % (face[k] + 1 + vbase, uv[k] + 1 + tbase)
                                        for k in range(len(face))) + "\n")
            vbase += len(verts); tbase += len(uvcoords)

        # skin: remap to only the cropped faces' verts to keep file lean
        sv = np.unique(fvert[skin_mask]); sremap = {int(o): i for i, o in enumerate(sv)}
        st = np.unique(fuvs[skin_mask]); stremap = {int(o): i for i, o in enumerate(st)}
        sfaces = np.array([[sremap[int(x)] for x in fc] for fc in fvert[skin_mask]])
        sfuvs = np.array([[stremap[int(x)] for x in fc] for fc in fuvs[skin_mask]])
        emit_block("skin", coord[sv], sfaces, sfuvs, texco[st], "skin")

        if hairfit:
            hc, hf, ht, hfu = hairfit
            emit_block("hair", hc, hf, hfu, ht, "hair")
        if eyesfit:
            ec, ef, et, efu = eyesfit
            emit_block("eyes", ec, ef, efu, et, "eye")

    with open(os.path.join(outdir, mtl_name), "w") as f:
        def mat(name, tex, col="0.8 0.8 0.8"):
            f.write("newmtl %s\nKd %s\n" % (name, col))
            if tex:
                f.write("map_Kd %s\n" % tex)
            f.write("\n")
        mat("skin", skin_tex, "1 0.95 0.85")
        mat("hair", hair_tex, "0.12 0.09 0.1")
        mat("eye", eye_tex, "1 1 1")

    # meta for framing
    hv = np.unique(fvert[skin_mask]); hcoord = coord[hv]
    meta = {"headMin": [float(x) for x in hcoord.min(0)],
            "headMax": [float(x) for x in hcoord.max(0)],
            "hair": hair, "skin": skin_rel}
    json.dump(meta, open(out.replace(".obj", ".meta.json"), "w"), indent=1)
    print("WROTE", out, "| skin", int(skin_mask.sum()), "faces | hair", hair, "| tex:", bool(skin_tex), bool(hair_tex), bool(eye_tex))


if __name__ == "__main__":
    main()
