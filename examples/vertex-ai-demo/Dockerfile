FROM node:22.20.0-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
