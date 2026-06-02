FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy workspace manifests and lockfile first (layer-cache friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package manifests for all workspace packages API depends on
COPY packages/config/package.json  ./packages/config/
COPY packages/types/package.json   ./packages/types/
COPY packages/utils/package.json   ./packages/utils/

# Copy API manifest + Prisma schema before install so prisma generate runs correctly
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma       ./apps/api/prisma/

# Install all dependencies (dev deps needed for tsc build)
RUN pnpm install --frozen-lockfile

# Copy workspace package sources
COPY packages/config ./packages/config/
COPY packages/types  ./packages/types/
COPY packages/utils  ./packages/utils/

# Copy API source
COPY apps/api/src        ./apps/api/src/
COPY apps/api/tsconfig.json ./apps/api/

# Generate Prisma client then compile TypeScript
RUN cd apps/api && pnpm prisma generate && pnpm build

EXPOSE 3001

# Run migrations then start
CMD ["sh", "-c", "cd /app/apps/api && npx prisma migrate deploy && node dist/index.js"]
