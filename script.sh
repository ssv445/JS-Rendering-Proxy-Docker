docker build -t js-rendering-proxy-docker .
 

docker tag js-rendering-proxy-docker readybytes/js-rendering-proxy-docker:latest
docker push readybytes/js-rendering-proxy-docker:latest

docker tag js-rendering-proxy-docker readybytes/js-rendering-proxy-docker:1.0.0
docker push readybytes/js-rendering-proxy-docker:1.0.0