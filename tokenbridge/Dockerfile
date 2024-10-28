FROM node:18-bullseye-slim
RUN apt-get update && \
    apt-get install -y git docker.io python3 build-essential curl jq
ARG TOKEN_BRIDGE_BRANCH=main
WORKDIR /workspace  
RUN git clone --no-checkout https://github.com/OffchainLabs/token-bridge-contracts.git ./
RUN git checkout ${TOKEN_BRIDGE_BRANCH}
RUN yarn install
RUN yarn build
ENTRYPOINT ["yarn"]
