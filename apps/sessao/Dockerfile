FROM oven/bun:1.4.4
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./server
COPY src ./src
USER bun
ENV NODE_ENV=production PORT=2568
EXPOSE 2568
CMD ["bun", "server/index.ts"]
