#!/usr/bin/env bash

set -euo pipefail

version=$(cat package.json | jq -r .version)
name=$(cat package.json | jq -r .name)

publishedVersion=$(pnpm info "$name" --json | jq -r .\"dist-tags\".latest)

if [ "$version" = "$publishedVersion" ]; then
    echo "Newest version is already deployed."
    exit 0
fi

echo "Deploying version $version."

pnpm install
pnpm publish

tag=$version
git tag -a "${tag}" -m "Release ${tag}"
git push origin "${tag}"
