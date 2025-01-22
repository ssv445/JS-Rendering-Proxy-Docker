#!/bin/sh

# This script reads the package.json file and builds the docker image
# It also tags the image with the version number and pushes it to the docker hub

# Get the version number from the package.json file
version=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

docker build -t js-rendering-proxy-docker .
 
docker tag js-rendering-proxy-docker readybytes/js-rendering-proxy-docker:latest
docker push readybytes/js-rendering-proxy-docker:latest

docker tag js-rendering-proxy-docker readybytes/js-rendering-proxy-docker:$version
docker push readybytes/js-rendering-proxy-docker:$version
