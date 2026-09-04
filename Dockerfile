# Build Next.js app with Bun and ship a slim Node runtime image.
FROM oven/bun:1.4 AS base
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
# Defaults mirror the in-code fallbacks so an unset build-arg behaves exactly
# like a local `bun run build` (GA fallback lives in src/app/layout.tsx).
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_AUTH_CALLBACK_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=G-6PH21R5KXN
ARG NEXT_PUBLIC_NO_INDEX=
ARG NEXT_PUBLIC_STRAWBERRY_BASE_URL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_AUTH_CALLBACK_URL=$NEXT_PUBLIC_AUTH_CALLBACK_URL
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_NO_INDEX=$NEXT_PUBLIC_NO_INDEX
ENV NEXT_PUBLIC_STRAWBERRY_BASE_URL=$NEXT_PUBLIC_STRAWBERRY_BASE_URL
COPY tsconfig.json next.config.ts postcss.config.mjs ./
COPY public ./public
COPY src ./src
RUN bun run build -- --webpack

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# The standalone server only needs Node. npm and its dependency tree are unused
# at runtime, so omit them from the production image and its vulnerability set.
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

# Next standalone build includes server.js at project root. Copy as the
# non-root `node` user (present in the base image) so the server doesn't run
# as root; `.next` is node-owned so the runtime fetch cache can be written.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 3000
CMD ["node", "server.js"]
