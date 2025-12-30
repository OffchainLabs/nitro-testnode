# Stage 1: Base build environment
FROM node:20-bookworm-slim AS base
WORKDIR /workspace
COPY ./package.json ./yarn.lock ./
RUN yarn

# Stage 2: Copy files and run build
FROM base AS pre-build
COPY ./*.ts ./tsconfig.json ./

# Stage 3: Copy resources
COPY ./resources ./resources
RUN echo "Intermediate image created before yarn build"

# Stage 4: Final build
FROM pre-build AS final
RUN yarn build
ENTRYPOINT ["node", "index.js"]
