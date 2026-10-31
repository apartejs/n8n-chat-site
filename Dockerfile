FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
COPY demo ./demo
COPY public ./public
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.mjs"]
