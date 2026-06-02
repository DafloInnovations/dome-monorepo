FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace config + lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy ALL packages including config
COPY packages/config ./packages/config/
COPY packages/types ./packages/types/
COPY packages/utils ./packages/utils/

# Copy API package files
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install ALL dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client BEFORE building
RUN cd apps/api && npx prisma generate

# Build shared packages FIRST
RUN pnpm --filter=@dome/types build
RUN pnpm --filter=@dome/utils build

# Copy and build API
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
RUN cd apps/api && pnpm build

EXPOSE 3001
CMD ["sh", "-c", "cd /app/apps/api && npx prisma migrate deploy && node dist/index.js"]
