FROM node:18-bullseye-slim
RUN apt-get update && \
    apt-get install -y git docker.io python3 make gcc g++ curl jq
ARG NITRO_CONTRACTS_BRANCH=main
WORKDIR /workspace  
RUN git clone --no-checkout https://github.com/OffchainLabs/nitro-contracts.git ./ && \
    git checkout ${NITRO_CONTRACTS_BRANCH} && \
    rm -rf .git && \
    git init && git add . && git -c user.name="user" -c user.email="user@example.com" commit -m "Initial commit"
RUN yarn install && yarn cache clean
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup
RUN touch scripts/config.ts
RUN yarn build:all
ENTRYPOINT ["yarn"]
