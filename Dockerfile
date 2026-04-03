FROM node:22-alpine
RUN apk add --no-cache wget python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
EXPOSE 3000
CMD ["npx", "tsx", "src/index.tsx"]
