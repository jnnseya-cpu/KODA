# KODA platform — production container (Cloud Run ready)
FROM node:22-alpine
WORKDIR /koda
# zero npm dependencies: copy sources only
COPY backend ./backend
COPY frontend ./frontend
COPY shared ./shared
COPY package.json landing-src.html ./
ENV NODE_ENV=production
ENV PORT=8080
ENV KODA_DATA_DIR=/data
VOLUME /data
EXPOSE 8080
USER node
CMD ["node", "--no-warnings", "backend/server.js"]
