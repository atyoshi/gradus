#!/bin/zsh
cd -- "${0:A:h}"
if [[ ! -d node_modules ]]; then
  echo 'Run npm install in this folder first.'
  exit 1
fi
npm run build || exit 1
npm start
