FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --production --no-optional

COPY . .

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
