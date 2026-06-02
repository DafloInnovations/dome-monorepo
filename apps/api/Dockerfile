FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace config + lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package manifests so pnpm can resolve the workspace graph
COPY packages/config/package.json  ./packages/config/
COPY packages/types/package.json   ./packages/types/
COPY packages/utils/package.json   ./packages/utils/
COPY apps/api/package.json         ./apps/api/
COPY apps/api/prisma               ./apps/api/prisma/

# Install everything (dev deps needed for tsc + tsup)
RUN pnpm install --frozen-lockfile

# Copy package sources and build them before the API
# @dome/config is plain JSON — no build step needed
COPY packages/types ./packages/types/
RUN pnpm --filter=@dome/types build

COPY packages/utils ./packages/utils/
RUN pnpm --filter=@dome/utils build

# Copy API source + tsconfig, generate Prisma client, compile
COPY apps/api/src        ./apps/api/src/
COPY apps/api/tsconfig.json ./apps/api/

RUN cd apps/api && pnpm prisma generate && pnpm build

EXPOSE 3001
CMD ["sh", "-c", "cd /app/apps/api && npx prisma migrate deploy && node dist/index.js"]
