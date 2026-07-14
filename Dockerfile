# Build Next.js app with Bun and ship a slim Node runtime image.
FROM oven/bun:1.3 AS base
WORKDIR /app

# Only the manifests before install: a config or source tweak must not
# invalidate the dependency layer and force a cold bun install.
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ci

FROM deps AS build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time;
# setting them at runtime cannot change client behavior, so they arrive here.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_AUTH_CALLBACK_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_AUTH_CALLBACK_URL=$NEXT_PUBLIC_AUTH_CALLBACK_URL
COPY tsconfig.json next.config.ts postcss.config.mjs ./
COPY public ./public
COPY src ./src
RUN bun run build -- --webpack

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Next standalone build includes server.js at project root. Copy as the
# non-root `node` user (present in the base image) so the server doesn't run
# as root; `.next` is node-owned so the runtime fetch cache can be written.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 3000
CMD ["node", "server.js"]
