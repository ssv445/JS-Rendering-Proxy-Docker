# Dockerized Puppeteer Scraper API

A containerized web scraping API built with Node.js, Fastify, and Puppeteer.

## Features

- Runs Puppeteer in a Docker container
- Built on Fastify for high performance
- Uses slim Node.js base image
- Includes all required Chromium dependencies
- Configurable through environment variables
- Development container support for VS Code

## Prerequisites

- Docker
- Node.js 18+
- VS Code (optional)

## Quick Start

1. Clone the repository

2. Build and run with Docker:

```
bash
docker build -t puppeteer-scraper .
docker run -p 3000:3000 puppeteer-scraper
```

3. Or use VS Code Dev Containers:
   - Install "Remote - Containers" extension
   - Open project in VS Code
   - Click "Reopen in Container"

## Environment Variables

- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`: Set to `true` (uses system Chromium)
- `PUPPETEER_EXECUTABLE_PATH`: Set to `/usr/bin/chromium`

## Development

The project includes a devcontainer configuration with:

- ESLint
- Prettier
- Git tools
- NPM utilities
- Path completion
- Auto-closing tags
- Other helpful VS Code extensions

## API Endpoints

Coming soon...

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Tech Stack

- Node.js
- Fastify
- Puppeteer
- Docker
- VS Code Dev Containers
