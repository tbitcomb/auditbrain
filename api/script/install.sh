#!/bin/sh

set -e

scriptDirName=$(cd -- "$(dirname -- "$0")" && pwd)
readabilityDir="$scriptDirName/../vendor/readability"

if [ ! -d  $readabilityDir ]; then
    git submodule add https://github.com/mozilla/readability.git "$scriptDirName/../vendor/readability"
fi

if [ ! -f "$scriptDirName/../.env" ]; then
    cp "$scriptDirName/../.env.template" "$scriptDirName/../.env"
fi

docker compose build api

# hostDenoLocation=$(which deno)

# if [ -f "$hostDenoLocation" ]; then
#     echo "attempting to cache for native deno"

#     deno cache "$scriptDirName/../deps.ts"
# fi
