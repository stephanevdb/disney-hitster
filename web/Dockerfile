FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY web/package.json ./web/

RUN npm ci

COPY web ./web
COPY data/songs.json ./web/src/data/songs.json

RUN npm run build --workspace=web

FROM node:22-alpine

RUN apk add --no-cache nginx openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY web/package.json ./web/

RUN npm ci --workspace=web --omit=dev

COPY web/server ./server
RUN mkdir -p /etc/nginx/http.d
COPY web/nginx.conf /etc/nginx/http.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/web/dist /usr/share/nginx/html
COPY data/songs.json /data/songs.json

ENV SONGS_PATH=/data/songs.json
ENV ADMIN_API_PORT=3001

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
