#!/usr/bin/env bash
# Copy the MakeHuman render textures the viewer (mhhead.html) needs from the
# vendored .references tree (gitignored) into public/mh/ (also gitignored).
# Run once before serving the viewer / capturing renders.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
MH="$HERE/../../../../.references/makehuman/makehuman"
PUB="$HERE/../../public/mh"
mkdir -p "$PUB"
cp "$MH/data/litspheres/skinmat_asian.png"  "$PUB/skinmat_asian.png"
cp "$MH/data/litspheres/skinmat_eye.png"    "$PUB/skinmat_eye.png"
cp "$MH/data/eyes/materials/brown_eye.png"  "$PUB/brown_eye.png"
echo "copied skin/eye textures -> $PUB"
