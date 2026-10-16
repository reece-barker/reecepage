#!/bin/bash
# Splits the long form video into small parts so Claude can copy it, and notes which tools this Mac has
cd "$HOME/Movies/Reece videos" || exit 1
rm -rf .parts && mkdir .parts
split -b 20m reece-barker-long-form-v3.mp4 .parts/p
shasum -a 256 reece-barker-long-form-v3.mp4 > .parts/sha256.txt
ls -la .parts
{
  echo "brew: $(command -v brew || ls /opt/homebrew/bin/brew 2>/dev/null)"
  echo "ffmpeg: $(command -v ffmpeg || ls /opt/homebrew/bin/ffmpeg 2>/dev/null)"
  echo "mysql: $(command -v mysql || ls /opt/homebrew/bin/mysql /usr/local/mysql/bin/mysql 2>/dev/null)"
  echo "docker: $(command -v docker || ls /usr/local/bin/docker 2>/dev/null)"
  echo "node: $(command -v node) $(node -v 2>/dev/null)"
  sw_vers 2>/dev/null; uname -m
} > "$HOME/Developer/reece-page/.machine-info.txt"
echo "Done, you can close this window"
