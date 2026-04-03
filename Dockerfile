FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc --outDir dist

FROM node:22-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY migrations ./migrations
EXPOSE 3000
CMD ["node", "dist/index.js"]
