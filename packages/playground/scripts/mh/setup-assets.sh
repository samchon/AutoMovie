#!/usr/bin/env bash
# Fetch the real MakeHuman community assets (hair geometry, asian skin texture,
# eye textures) the hero pipeline needs, and place them where MakeHuman's loaders
# and the viewers expect them. The makehuman-assets repo stores textures in Git
# LFS; the LFS smudge fails under a sparse/partial clone, so textures are pulled
# directly via the media.githubusercontent.com LFS endpoint.
#
# Idempotent. Run once after cloning .references/makehuman.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REF="$HERE/../../../../.references"
DATA="$REF/makehuman/makehuman/data"
PUB="$HERE/../../public/mh"
ASSETS="$REF/makehuman-assets"
M="https://media.githubusercontent.com/media/makehumancommunity/makehuman-assets/master/base"
mkdir -p "$PUB"

# 1. sparse-clone the asset metas (obj/mhclo/mhmat — not the LFS textures)
if [ ! -d "$ASSETS/.git" ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/makehumancommunity/makehuman-assets.git "$ASSETS"
fi
( cd "$ASSETS" && GIT_LFS_SKIP_SMUDGE=1 git sparse-checkout set base/hair base/skins base/eyes base/eyebrows base/litspheres )

# 2. copy hair + skin + eyebrow metas into MakeHuman's data tree
for h in long01 bob01 bob02 ponytail01 braid01 short01 afro01; do
  mkdir -p "$DATA/hair/$h"; cp "$ASSETS/base/hair/$h/"* "$DATA/hair/$h/" 2>/dev/null || true
done
for e in eyebrow006 eyebrow007 eyebrow010; do
  mkdir -p "$DATA/eyebrows/$e"; cp "$ASSETS/base/eyebrows/$e/"* "$DATA/eyebrows/$e/" 2>/dev/null || true
  curl -sL "$M/eyebrows/$e/$e.png" -o "$DATA/eyebrows/$e/$e.png" 2>/dev/null || true
done
mkdir -p "$DATA/skins/young_asian_female" "$DATA/skins/textures"
cp "$ASSETS/base/skins/young_asian_female/"* "$DATA/skins/young_asian_female/" 2>/dev/null || true

# 3. pull the LFS textures via the media endpoint
curl -sL "$M/skins/textures/young_lightskinned_female_diffuse3.png" \
     -o "$DATA/skins/textures/young_lightskinned_female_diffuse3.png"
for h in long01 bob01 bob02 ponytail01 braid01 short01 afro01; do
  curl -sL "$M/hair/$h/${h}_diffuse.png" -o "$DATA/hair/$h/${h}_diffuse.png" 2>/dev/null || true
done

# 4. litspheres the mhfull.html viewer uses for MakeHuman-identical render
curl -sL "$M/litspheres/lit_standard_skin.png" -o "$PUB/lit_standard_skin.png" 2>/dev/null || true
curl -sL "$M/litspheres/lit_hair.png" -o "$PUB/lit_hair.png" 2>/dev/null || true
cp "$REF/makehuman/makehuman/data/litspheres/skinmat_asian.png" "$PUB/skinmat_asian.png" 2>/dev/null || true
cp "$REF/makehuman/makehuman/data/litspheres/skinmat_eye.png"   "$PUB/skinmat_eye.png" 2>/dev/null || true
cp "$REF/makehuman/makehuman/data/eyes/materials/brown_eye.png" "$PUB/brown_eye.png" 2>/dev/null || true
echo "MakeHuman assets ready (hair geometry + young_asian_female skin + eye textures)."
