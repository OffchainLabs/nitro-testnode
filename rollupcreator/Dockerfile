FROM node:16-bullseye-slim
ARG NITRO_CONTRACTS_BRANCH=main
RUN apt-get update && \
    apt-get install -y git docker.io python3 build-essential curl jq
WORKDIR /workspace  
RUN git clone --no-checkout https://github.com/OffchainLabs/nitro-contracts.git ./
RUN git checkout ${NITRO_CONTRACTS_BRANCH}
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup
RUN touch scripts/config.ts
RUN yarn install
RUN yarn build:all
ENTRYPOINT ["yarn"]
