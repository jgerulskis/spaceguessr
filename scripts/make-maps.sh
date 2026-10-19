#!/usr/bin/env bash
# Downscale raw equirectangular textures into img/maps/<body>.jpg (plus 256px thumbs).
# Usage: scripts/make-maps.sh <raw-dir> [body ...]
# Every output must be east-positive, north-up. Set flip=yes for a source drawn
# with longitude increasing to the left (check with index.html?debug=1).
set -euo pipefail
RAW="${1:?usage: make-maps.sh <raw-dir> [body ...]}"; shift || true
ONLY="$*"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/img/maps"; THUMBS="$ROOT/img/thumbs"
mkdir -p "$OUT" "$THUMBS"

# body | raw filename | output width | flip
TABLE="
moon|moon.tif|4096|no
mars|mars.jpg|4096|no
earth|earth.jpg|4096|no
venus|venus.tif|2048|no
titan|titan.tif|2048|no
pluto|pluto.tif|2048|no
mercury|mercury.tif|2048|no
vesta|vesta.tif|2048|no
io|io.tif|2048|no
europa|europa.tif|2048|no
ganymede|ganymede.tif|2048|no
callisto|callisto.tif|2048|no
enceladus|enceladus.tif|2048|no
"

while IFS='|' read -r body file width flip; do
  [ -z "$body" ] && continue
  if [ -n "$ONLY" ] && ! [[ " $ONLY " == *" $body "* ]]; then continue; fi
  src="$RAW/$file"
  if [ ! -f "$src" ]; then echo "skip $body (no $file)"; continue; fi
  dst="$OUT/$body.jpg"
  args=(-s format jpeg -s formatOptions 85 -Z "$width")
  [ "$flip" = "yes" ] && args+=(-f horizontal)
  if sips "${args[@]}" "$src" --out "$dst" >/dev/null 2>&1; then
    tmp="$OUT/.$body.thumb.tmp.jpg"
    sips --resampleHeight 384 "$dst" --out "$tmp" >/dev/null 2>&1 && \
    sips -c 256 256 "$tmp" --out "$THUMBS/$body.jpg" >/dev/null 2>&1 || true
    rm -f "$tmp"
    echo "ok   $body -> $(sips -g pixelWidth -g pixelHeight "$dst" | awk '/pixel/ {printf "%s ", $2}') $(du -h "$dst" | cut -f1)"
  else
    echo "FAIL $body ($file) — sips could not convert it"
  fi
done <<< "$TABLE"
