# Build the Axum API with a minimal runtime image.
# Use nightly to support crates opting into Rust 2024 edition.
FROM rustlang/rust:nightly-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY rust-api/Cargo.toml rust-api/
COPY rust-api/src rust-api/src
WORKDIR /app/rust-api
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/rust-api/target/release/app_api /usr/local/bin/app_api
ENV APP_PORT=8080
ENV RUST_LOG=info

EXPOSE 8080
CMD ["app_api"]
