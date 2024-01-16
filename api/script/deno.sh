#!/bin/sh

docker compose run --rm --service-ports --use-aliases api deno "$@"