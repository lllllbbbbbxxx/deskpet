#!/bin/zsh

set -e

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

if [ -x "./node_modules/.bin/electron" ]; then
  npm run app
  exit 0
fi

echo "Electron is not installed yet."
echo "Installing npm dependencies..."
npm install
npm run app
