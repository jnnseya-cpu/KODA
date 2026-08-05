# KODA platform — production container. Zero npm dependencies: the whole OS
# runs on the Node core runtime (node:http + node:sqlite + node:crypto).
FROM node:22-alpine

# tini for correct signal handling (graceful SIGTERM → WAL checkpoint), wget for healthcheck
RUN apk add --no-cache tini wget

WORKDIR /koda

# sources only — there is nothing to `npm install`
COPY backend ./backend
COPY frontend ./frontend
COPY shared ./shared
COPY package.json landing-src.html ./

# build identity (passed by CI: --build-arg KODA_BUILD_SHA=$GIT_SHA ...)
ARG KODA_BUILD_SHA=dev
ARG KODA_BUILD_DATE=unknown
ENV KODA_BUILD_SHA=$KODA_BUILD_SHA \
    KODA_BUILD_DATE=$KODA_BUILD_DATE \
    NODE_ENV=production \
    PORT=8080 \
    KODA_DATA_DIR=/data

# persistent SQLite volume — must be writable by the non-root runtime user
RUN mkdir -p /data && chown -R node:node /data /koda
VOLUME /data
EXPOSE 8080
USER node

# liveness probe (readiness is /readyz — also DB-checks)
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--no-warnings", "backend/server.js"]
