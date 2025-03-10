#!/bin/sh

# This script reads the package.json file and builds the docker image
# It also tags the image with the version number and pushes it to the docker hub

# Get the version number from the package.json file
version=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

# Create and use a new builder instance
docker buildx create --name multiarch --driver docker-container --use || true
docker buildx inspect --bootstrap

if [ "$1" = "push" ]; then
    # Build and push for multiple platforms
    docker buildx build --platform linux/amd64,linux/arm64/v8 \
        --tag readybytes/js-rendering-proxy-docker:latest \
        --tag readybytes/js-rendering-proxy-docker:$version \
        --push .
else
    # Local build for current platform
    docker buildx build --load -t js-rendering-proxy-docker .
fi
