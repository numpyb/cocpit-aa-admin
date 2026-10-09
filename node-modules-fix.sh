#!/bin/sh
# Ensure node_modules/ and package-lock.json reflect package.json.
#
# This fork does not carry the cockpit-project "node_modules gitlink" that
# tools/node-modules expects, so that mechanism fails with
# "couldn't read gitlink for file node_modules from the index".
# A plain npm install is the simplest reliable approach.

set -eu

# Already installed and up to date: nothing to do.
if [ -d node_modules ] && [ -f package-lock.json ] && [ package-lock.json -nt package.json ]; then
    exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
    if [ -d node_modules ]; then
        echo "npm not found; using existing node_modules/ as-is." >&2
        exit 0
    fi
    echo "npm is required to install node_modules/ (not found on PATH)." >&2
    exit 1
fi

if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi
