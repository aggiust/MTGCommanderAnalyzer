# syntax=docker/dockerfile:1

# Base ufficiale Node 20 + Puppeteer 24.11.x + Chrome 138
FROM ghcr.io/puppeteer/puppeteer:24.11.0

WORKDIR /app

# 1. installa le dipendenze JS
COPY package*.json ./
RUN npm ci --omit=dev

# 2. copia il resto del progetto
COPY . .

# cartella condivisa per gli output
RUN mkdir -p /app/output
VOLUME ["/app/output"]

ENV NODE_ENV=production

ENTRYPOINT ["node", "src/index.js"]
