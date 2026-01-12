FROM oven/bun:1.0.5-alpine AS base
WORKDIR /app

COPY package.json ./
COPY bun.lock ./
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY ./prisma ./prisma

RUN bun install
RUN bunx prisma generate

COPY . .
EXPOSE 3000 3001
ENTRYPOINT [ "bun", "run", "dev" ]