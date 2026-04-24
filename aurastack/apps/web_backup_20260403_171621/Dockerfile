FROM node:20 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json

RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}

RUN npm run build --workspace @smart-case-buddy/shared-types
RUN npm run build --workspace @smart-case-buddy/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

