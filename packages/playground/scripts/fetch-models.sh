#!/usr/bin/env bash
# Download the VRoid AvatarSample VRMs the human editor renders. They are ~15 MB
# each and free sample avatars, so they are fetched on demand rather than
# committed. Run before `pnpm --filter @motica/playground dev`.
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/models"
mkdir -p "$dir"
base="https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable"
for name in AvatarSample_A AvatarSample_B; do
  echo "fetching ${name}.vrm..."
  curl -fL "${base}/${name}.vrm" -o "${dir}/${name}.vrm"
done
echo "done -> ${dir}"
