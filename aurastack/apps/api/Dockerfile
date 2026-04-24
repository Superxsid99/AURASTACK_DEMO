FROM node:20 AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json

RUN npm ci

COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace @smart-case-buddy/shared-types
RUN npm run build --workspace @smart-case-buddy/api

EXPOSE 8000
CMD ["node", "apps/api/dist/server.js"]
