FROM node:20-alpine

WORKDIR /app

# Required for Prisma on Alpine
RUN apk add --no-cache libc6-compat openssl

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Generate Prisma client and build Next.js
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# On startup: create/migrate the database, seed default data, then start the app
CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && npm start"]
