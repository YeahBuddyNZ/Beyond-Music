# Beyond Music on any computer with Docker: a NAS, a mini PC, an old laptop.
#   docker build -t beyond-music .
#   docker run -d --name beyond-music --network host --restart unless-stopped \
#     -v beyond-music:/data -v /path/to/your/Music:/music/Music:ro beyond-music
# Then open http://<this computer>:8097. Everything under /music is played; add more folders in Settings.

FROM node:22-alpine AS web
WORKDIR /web
COPY beyond_music/config.yaml /config.yaml
COPY beyond_music/web/package.json beyond_music/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY beyond_music/web/ ./
RUN npm run build:box

FROM node:22-alpine
# CD copying: abcde reads the disc with cdparanoia and writes FLAC. Plug a USB CD drive in and pass it through
# with --device /dev/sr0.
RUN apk add --no-cache abcde cdparanoia flac || true
COPY beyond_music/server/ /app/server/
COPY --from=web /web/dist /app/www
ENV BEYOND_MUSIC_WWW=/app/www BEYOND_MUSIC_DATA=/data BEYOND_MUSIC_FOLDERS=/music
VOLUME /data
EXPOSE 8097
CMD ["node", "/app/server/main.mjs"]
