#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dump MakeHuman's complete, config-independent modifier -> target table so the JS
port can reproduce getTargetWeights() without re-implementing the filename crawler.

Output JSON (to argv[1], default packages/playground/data/mh/modifiers.json):
{
  "categories": [["gender",["male","female"]], ...],     # targets._cat_data
  "valueCat": { "female":"gender", ... },
  "modifiers": [
     { "fullName","group","name","type",
       "left","center","right",                          # target-group keys or null
       "min","max","defaultValue",
       "targets": [ { "path": "<relpath under data/targets>", "factors": [...] }, ... ]
     }, ...
  ]
}
Paths are made relative to data/targets/ and forward-slashed.
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

import getpath
from core import G
import types
G.app = types.SimpleNamespace(progress=None, selectedHuman=None, events=[],
                              settings={}, addLogMessage=lambda *a, **k: None)

import files3d
from human import Human
import humanmodifier
import targets as targets_mod

TARGETS_ROOT = os.path.abspath(getpath.getSysDataPath("targets")).replace("\\", "/")


def relpath(p):
    p = os.path.abspath(p).replace("\\", "/")
    if p.startswith(TARGETS_ROOT + "/"):
        return p[len(TARGETS_ROOT) + 1:]
    return p


def dump_targets(tlist):
    return [{"path": relpath(t[0]), "factors": list(t[1])} for t in (tlist or [])]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(
        os.path.join(MH, "..", "..", "..", "packages", "playground", "data", "mh", "modifiers.json"))
    out = os.path.abspath(out)

    base = files3d.loadMesh(getpath.getSysDataPath("3dobjs/base.obj"))
    human = Human(base)
    humanmodifier.loadModifiers(getpath.getSysDataPath('modifiers/modeling_modifiers.json'), human)

    mods = []
    for m in human.modifiers:
        entry = {
            "fullName": m.fullName,
            "group": m.groupName,
            "name": m.name,
            "type": type(m).__name__,
            "left": getattr(m, "left", None),
            "center": getattr(m, "center", None),
            "right": getattr(m, "right", None),
            "min": m.getMin(),
            "max": m.getMax(),
            "defaultValue": m.getDefaultValue(),
            "macroVariable": getattr(m, "macroVariable", None),
            "targets": dump_targets(getattr(m, "targets", [])),
        }
        mods.append(entry)

    data = {
        "categories": targets_mod._cat_data,
        "valueCat": targets_mod._value_cat,
        "targetsRoot": "data/targets",
        "modifiers": mods,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(data, open(out, "w"), indent=1)
    nt = sum(len(m["targets"]) for m in mods)
    print("WROTE", out, "| modifiers", len(mods), "| total target refs", nt)


if __name__ == "__main__":
    main()
