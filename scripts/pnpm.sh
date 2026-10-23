#!/bin/sh
# Prefer the isolated runtime when present; otherwise use nvm/fnm's active Node.
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
node_version=$(cat .nvmrc)
platform=$(uname -s | tr '[:upper:]' '[:lower:]')
machine=$(uname -m)
case "$machine" in
  aarch64) machine=arm64 ;;
  x86_64) machine=x64 ;;
esac
runtime_bin="$project_dir/.local-runtime/node-v$node_version-$platform-$machine/bin"
if [ -x "$runtime_bin/node" ]; then
  PATH="$runtime_bin:$PATH"
  export PATH
fi
if [ "$(node --version)" != "v$node_version" ]; then
  echo "This project uses Node $node_version. Run nvm install && nvm use, then retry." >&2
  exit 1
fi
COREPACK_HOME="$project_dir/.local-runtime/corepack"
export COREPACK_HOME
exec corepack pnpm "$@"
