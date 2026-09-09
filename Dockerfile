FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# bootstrap-db идемпотентен (CREATE TABLE IF NOT EXISTS) — безопасен при
# каждом старте; seed наполняет меню и афишу только если они пустые.
CMD ["sh", "-c", "npm run db:bootstrap && npm run db:seed && npm start"]
