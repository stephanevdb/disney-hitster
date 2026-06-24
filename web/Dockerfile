FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY web/package.json ./web/

RUN npm ci

COPY web ./web
COPY data/songs.json ./web/src/data/songs.json

RUN npm run build --workspace=web

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/web/dist /usr/share/nginx/html

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
