#!/bin/bash

SRC_DIR="."
DEST_DIR="$HOME"

# Ensure the source directory exists
if [[ ! -d "$SRC_DIR" ]]; then
  echo "Source directory $SRC_DIR does not exist."
  exit 1
fi

# Iterate over all files in src/http/scripts and create symlinks in home directory
for file in "$SRC_DIR"/*; do
  if [[ -f "$file" ]]; then
    ln -sfn "$(realpath "$file")" "$DEST_DIR/$(basename "$file")"
    echo "Linked: $file -> $DEST_DIR/$(basename "$file")"
  fi
done
