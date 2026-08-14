# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY server.js ./

# Create data directory for persistent auth storage
RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 80
CMD ["node", "server.js"]
