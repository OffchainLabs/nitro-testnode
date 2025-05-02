# Stage 1: Base build environment
FROM node:18-bookworm-slim AS base
WORKDIR /workspace
COPY ./package.json ./yarn.lock ./
RUN yarn

# Stage 2: Copy files and run build
FROM base AS pre-build
COPY ./*.ts ./tsconfig.json ./
RUN echo "Intermediate image created before yarn build"

# Stage 3: Final build
FROM pre-build AS final
RUN yarn build
ENTRYPOINT ["node", "index.js"]
