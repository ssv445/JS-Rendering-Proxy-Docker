# JS-Rendering-Proxy-Docker

A containerized web scraping Proxy API built with Node.js, Fastify, and Puppeteer.

## Why This Exists

- Traditional PHP crawlers can't process JavaScript, making them ineffective for:

  - React applications
  - Angular applications
  - Other JavaScript-heavy sites
  - Single-page applications (SPAs)

- This proxy service:
  - Acts as a bridge between PHP crawlers and modern web apps
  - Returns fully rendered HTML after JavaScript execution
  - Requires no modifications to existing crawler logic
  - Handles client-side rendering transparently
  - Does not follow redirects
  - Returns all the HTTP errors as it is
  - Blocks CSS and media.

## Features

- Runs Puppeteer in a Docker container
- Built on Fastify for high performance
- Uses slim Node.js base image
- Includes all required Chromium dependencies
- Configurable through environment variables
- Development container support for VS Code
- Blocks CSS, media and configurable JS resources
- Request rate limiting and concurrent request control
- Detailed request logging
- Process cleanup for zombie/orphaned Chrome processes
- Graceful timeout and error handling
- Configurable redirect behavior

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
- `EXECUTABLE_PATH`: Path to Chromium executable (default: `/usr/bin/chromium`)
- `API_KEY`: Set your secret API key for authentication (optional)
- `DEBUG`: Enable debug logging (optional)
- `SERVER_NAME`: Server identifier for logs (optional)
- `MAX_CONCURRENT_REQUESTS`: Maximum concurrent requests allowed (default: 10)

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

The only endpoint is render, which accepts URL to render and return HTML. API key must be provided in the X-API-Key header.

```
http://localhost:3000/?render_url=[The-URL-To-Render]
X-API-Key: YOUR_API_KEY
```

Or you can use it as a proxy.

```javascript
// Using axios:
const axios = require("axios");

const proxyClient = axios.create({
  proxy: {
    host: "localhost",
    port: 3000,
    protocol: "http",
  },
  headers: {
    "X-API-Key": "YOUR_API_KEY",
  },
});

// Make requests through proxy
await proxyClient.get("https://example.com");
```

## API Headers

The following custom headers can be used to control the page rendering behavior:

| Header                   | Description                                                                                                 | Default                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `user-agent`             | User agent string to use for the browser                                                                    | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36` |
| `x-page-timeout-ms`      | Maximum time to wait for page load in milliseconds                                                          | 60000                                                                                                                       |
| `x-wait-until-condition` | When to consider navigation successful. Options: `load`, `domcontentloaded`, `networkidle0`, `networkidle2` | `networkidle2`                                                                                                              |
| `x-block-js`             | Blocks given JS file names (comma separated), using file names                                              | []                                                                                                                          |
| `x-follow-redirects`     | Whether to follow redirects                                                                                 | false                                                                                                                       |
| `x-api-key`              | API key for authentication (required if API_KEY env var is set)                                             | null                                                                                                                        |

### CURL Support

This proxy does not support CURL requests because CURL always uses tunneling for HTTPS URLs. For HTTPS requests, use alternative HTTP clients like:

- axios
- fetch
- got
- node-fetch
- request
- superagent

Or disable HTTPS tunneling in CURL (not possible as if now).
