#!/bin/sh

# This script reads the package.json file and builds the docker image
# It also tags the image with the version number and pushes it to the docker hub

# Get the version number from the package.json file
version=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

# build the docker image for all the platforms
docker buildx build --platform linux/amd64 -t js-rendering-proxy-docker .

# tag the image with the version number
docker tag js-rendering-proxy-docker readybytes/js-rendering-proxy-docker:latest
docker push readybytes/js-rendering-proxy-docker:latest

# tag the image with the version number
docker tag js-rendering-proxy-docker readybytes/js-rendering-proxy-docker:$version
docker push readybytes/js-rendering-proxy-docker:$version
