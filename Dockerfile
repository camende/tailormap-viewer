# Stage 1: Build the Angular frontend
ARG VERSION=snapshot
ARG API_VERSION=feature-uploads   # jouw custom tailormap-api image tag

FROM node:24.12.0 AS builder

ARG BASE_HREF=/

WORKDIR /app

# Install dependencies
COPY ./package.json ./package-lock.json /app/
RUN npm install

# Copy source
COPY . /app

# Build the frontend
RUN npm run build -- --base-href=${BASE_HREF}

# Stage 2: Combine frontend with your custom tailormap-api
FROM camende/tailormap-api:${API_VERSION}   # <-- je eigen image

ARG VERSION=${VERSION}
ARG API_VERSION=${API_VERSION}

LABEL org.opencontainers.image.authors="camende" \
      org.opencontainers.image.description="Tailormap Viewer with custom API" \
      org.opencontainers.image.vendor="B3Partners BV" \
      org.opencontainers.image.title="Tailormap Viewer" \
      org.opencontainers.image.source="https://github.com/camende/tailormap-viewer/" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.base.name="camende/tailormap-api:$API_VERSION" \
      tailormap-api.version="$API_VERSION"

# Copy the Angular build to the API container
COPY --from=builder /app/dist/app static/

