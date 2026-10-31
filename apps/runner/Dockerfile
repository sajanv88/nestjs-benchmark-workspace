# syntax=docker/dockerfile:1
#
# The load-test runner. It reaches the bench apps over the compose network.
# Build from the repo root:  docker build -f apps/runner/Dockerfile -t runner:local .

# Node: exact version (matches .node-version) pinned by multi-arch index digest.
ARG NODE_IMAGE=node:26.12.0-alpine3.24@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5

# ---- base: Node + pnpm (standalone binary, checksum-verified; no npm, no Corepack) ----
FROM ${NODE_IMAGE} AS base
# Keep PNPM_VERSION equal to "packageManager" in package.json. The checksums are the
# GitHub release assets pnpm-linux-{x64,arm64}-musl.tar.gz for that version.
ARG PNPM_VERSION=12.14.0
ARG PNPM_SHA256_AMD64=d7115e2f2791d79bf9e7e448609537595bb7787de1ef5292ce91ff3d1be2629e
ARG PNPM_SHA256_ARM64=511a54809bdfd28270d30011d1697f582c8130d555b4fa0e2856b1a7534c98bf
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) arch=x64; sha="${PNPM_SHA256_AMD64}" ;; \
      arm64) arch=arm64; sha="${PNPM_SHA256_ARM64}" ;; \
      *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    wget -qO /tmp/pnpm.tar.gz "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linux-${arch}-musl.tar.gz"; \
    echo "${sha}  /tmp/pnpm.tar.gz" | sha256sum -c -; \
    mkdir -p /opt/pnpm; \
    tar -xzf /tmp/pnpm.tar.gz -C /opt/pnpm; \
    rm /tmp/pnpm.tar.gz; \
    ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm; \
    pnpm --version
ENV pnpm_config_store_dir=/pnpm/store \
    TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

# ---- pruner: a copy of the monorepo with only runner and what it depends on ----
FROM base AS pruner
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm dlx "turbo@$(node -p 'require("./package.json").devDependencies.turbo')" prune runner --docker

# ---- deps: install from the lockfile; this layer is reused until a manifest changes ----
FROM base AS deps
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch && pnpm install --frozen-lockfile --offline

# ---- builder: compile, then deploy production dependencies into a self-contained folder ----
FROM deps AS builder
COPY --from=pruner /repo/out/full/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm exec turbo run build --filter=runner && \
    pnpm --filter=runner deploy --prod --legacy /deploy

# ---- runner: compiled output and production dependencies only, non-root ----
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs -H -s /sbin/nologin runner
COPY --from=builder /deploy ./
LABEL org.opencontainers.image.title="runner" \
      org.opencontainers.image.licenses="UNLICENSED"
USER 1001:1001
EXPOSE 4000
CMD ["node", "dist/server.js"]
