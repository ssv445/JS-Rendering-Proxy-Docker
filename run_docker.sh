
PORT=3109
# Run the docker container
echo "Running the docker container"
docker run -d \
  --name js-rendering-proxy-docker-local \
  -p $PORT:3000 \
  -e API_KEY=1234567890 \
  --restart unless-stopped \
  js-rendering-proxy-docker

echo "Docker container running on port $PORT"
# tail the docker logs
docker logs -f js-rendering-proxy-docker-local
