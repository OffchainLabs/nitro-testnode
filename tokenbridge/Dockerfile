FROM node:16-bullseye-slim
ARG TOKEN_BRIDGE_BRANCH=main
RUN apt-get update && \
    apt-get install -y git docker.io python3 build-essential
WORKDIR /workspace  
RUN git clone --no-checkout https://github.com/OffchainLabs/token-bridge-contracts.git ./
RUN git checkout ${TOKEN_BRIDGE_BRANCH}
RUN yarn install
RUN yarn build
ENTRYPOINT ["yarn"]
