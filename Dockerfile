FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/data

ENV DB_PATH=/app/data/atletica.db
ENV PORT=3000
ENV JWT_SECRET=change-this-secret-in-production

EXPOSE 3000

CMD ["node", "server.js"]
