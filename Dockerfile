FROM node:18-slim

ENV \
    # Configure default locale (important for chrome-headless-shell).
    LANG=en_US.UTF-8

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chrome that Puppeteer
# installs, work.
RUN apt-get update

RUN apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf dbus dbus-x11

RUN apt-get install -y gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2
RUN apt-get install -y libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 
RUN apt-get install -y libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 
RUN apt-get install -y libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 
RUN apt-get install -y libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 
RUN apt-get install -y lsb-release xdg-utils wget libgbm-dev wget gnupg


# Install required dependencies for Puppeteer
RUN apt-get update &&  apt-get install -y chromium 

# Set Puppeteer to use Chromium instead of Chrome
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create and set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install NPM dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]