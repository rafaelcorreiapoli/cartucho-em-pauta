FROM oven/bun:1.4.4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/simulation/package.json packages/simulation/package.json
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4
WORKDIR /app
COPY --from=dependencies /app /app
COPY apps/server/src apps/server/src
COPY packages/simulation/src packages/simulation/src
USER bun
ENV NODE_ENV=production PORT=2567
EXPOSE 2567
CMD ["bun", "apps/server/src/index.ts"]
