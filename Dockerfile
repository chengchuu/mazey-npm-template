FROM node:22-bookworm-slim

WORKDIR /web

COPY . .
RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/web/scripts/docker-entrypoint.sh"]
