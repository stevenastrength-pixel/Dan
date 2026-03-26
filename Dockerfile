FROM node:20-alpine

WORKDIR /app

# Required for Prisma on Alpine
RUN apk add --no-cache libc6-compat openssl

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create a temporary database so Next.js can prerender API routes during build
# The real database is mounted as a volume at runtime
ENV DATABASE_URL=file:/tmp/build.db
RUN npx prisma db push

RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# On startup: create/migrate the database, seed default data, then start the app
CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && npm start"]
