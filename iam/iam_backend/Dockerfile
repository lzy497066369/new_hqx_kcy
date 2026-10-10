FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY --chown=node:node dist ./dist
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node sql ./sql

USER node
EXPOSE 3101

CMD ["node", "dist/main.js"]
