FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# db:push на свежей БД создаёт схему; на существующей (где всё уже есть)
# drizzle-kit может упасть на повторном ALTER — это не должно ронять контейнер.
CMD ["sh", "-c", "npm run db:push || echo 'db:push skipped (schema already applied)'; npm start"]
