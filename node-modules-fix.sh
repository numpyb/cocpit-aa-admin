#!/bin/sh
# Ensure node_modules/ and package-lock.json reflect package.json.
# Fresh projects don't carry the cockpit-project node_modules gitlink, so a
# plain npm install is the simplest reliable approach.

set -eu

if [ -d node_modules ] && [ -f package-lock.json ] && [ package-lock.json -nt package.json ]; then
    exit 0
fi

npm install