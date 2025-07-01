# syntax=docker/dockerfile:1

# Base ufficiale Node 20 + Puppeteer 24.11.x + Chrome 138
FROM ghcr.io/puppeteer/puppeteer:24.11.0

USER root

WORKDIR /app

# 1. installa le dipendenze JS
COPY package*.json ./
RUN npm ci --omit=dev

# 2. copia il resto del progetto
COPY . .

# cartella condivisa per gli output
# RUN mkdir -p /app/results
# Indica che questa directory può essere usata come volume
VOLUME ["/app/results"]

ENV NODE_ENV=production

ENTRYPOINT ["node", "src/index.js"]
