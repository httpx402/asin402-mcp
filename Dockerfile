FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js ./
# Without ASIN402_PRIVATE_KEY the server still starts and lists its tools; paid tools explain how to add a wallet.
ENTRYPOINT ["node", "index.js"]
