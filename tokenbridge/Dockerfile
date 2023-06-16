FROM node:16-bullseye-slim
RUN apt-get update && \
    apt-get install -y git docker.io
WORKDIR /workspace  
RUN git clone --depth 1 -b v3.1.4 https://github.com/OffchainLabs/arbitrum-sdk.git ./
RUN yarn install
ENTRYPOINT ["yarn"]
