# Stage 1: Base build environment
FROM node:18-bullseye-slim AS base
WORKDIR /workspace
COPY ./package.json ./yarn.lock ./
RUN yarn

# Stage 2: Copy files and run build
FROM base AS pre-build
COPY ./*.ts ./tsconfig.json ./
COPY ./nitro-contracts ./nitro-contracts

RUN if [ -d "./nitro-contracts/DEV_CONTRACTS" ]; then \
      echo "Overwriting @arbitrum/nitro-contracts with local version"; \
      rm -rf node_modules/@arbitrum/nitro-contracts; \
      cp -a ./nitro-contracts node_modules/@arbitrum/nitro-contracts; \
    else \
      echo "local nitro-contracts directory not found, using npm version"; \
    fi
# At this stage, the intermediate image will stop
RUN echo "Intermediate image created before yarn build"

# Stage 3: Final build
FROM pre-build AS final
RUN yarn build
ENTRYPOINT ["node", "index.js"]
