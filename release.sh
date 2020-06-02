#!/usr/bin/env bash

set -euo pipefail

version=$(cat package.json | jq -r .version)
name=$(cat package.json | jq -r .name)

publishedVersion=$(yarn info "$name" --json | jq -r .data.\"dist-tags\".latest)

if [ "$version" = "$publishedVersion" ]; then
    echo "Newest version is already deployed."
    exit 0
fi

echo "Deploying version $version."

yarn publish
