#!/bin/sh
# Assembla index.html a partire dai pezzi in src/
set -e
cd "$(dirname "$0")"
{
  cat src/shell_head.html
  cat src/home_top.html
  cat src/_hero.svg
  cat src/home_bot.html
  cat src/_sections_cub_den.html
  cat src/ipso_section.html
  cat src/area_section.html
  cat src/app_mid.html
  echo '</main>'
  echo '<script>'; cat src/clima.js; echo '</script>'
  cat src/app_js.html
  cat src/ipso.js
  cat src/area.js
  cat src/cam.js
  cat src/app_js2.html
  cat src/app_js3.html
  cat src/pwa.js
  cat src/home.js
  echo '</body></html>'
} > index.html
echo "index.html: $(wc -c < index.html) byte"
