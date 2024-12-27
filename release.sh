#!/usr/bin/env bash

set -euo pipefail

version=$(cat package.json | jq -r .version)
name=$(cat package.json | jq -r .name)

publishedVersion=$(pnpm info "$name" --json | jq -r .\"dist-tags\".latest)

if [ "$version" = "$publishedVersion" ]; then
    echo "Newest version is already deployed."
    exit 0
fi

if ! git diff --quiet; then
  echo "Uncommited changes detected:"
  echo "==========================="
  git status
  git diff
  echo "==========================="
  exit 1
fi

echo "Deploying version $version."
pnpm publish

tag=$version
git tag -a "${tag}" -m "Release ${tag}"
git push origin "${tag}"
