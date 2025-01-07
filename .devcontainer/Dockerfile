FROM node:18-slim

# Install required dependencies for Puppeteer
RUN apt-get update && \
    apt-get install -y wget gnupg ca-certificates \
    chromium \
    libgconf-2-4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnss3 \
    libxss1 \
    libasound2 && \
    rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use Chromium instead of Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port
EXPOSE 3000
