#!/usr/bin/env bash
# Download the VRM avatar the human editor renders.
#
# Model: "Vita" — a VRoid sample avatar released CC0 (public domain). No usage,
# redistribution, or attribution restriction whatsoever, so it is fully
# compatible with this MIT-licensed project (unlike VRoid models whose embedded
# VRM license is "Other" with no terms URL). The file (~14 MB) is fetched on
# demand rather than committed.
#
# Run before `pnpm --filter @motica/playground dev`.
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/models"
mkdir -p "$dir"
url="https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/beta/Vita.vrm"
echo "fetching Vita.vrm (CC0)..."
curl -fL "$url" -o "$dir/Vita.vrm"
echo "done -> $dir/Vita.vrm"
