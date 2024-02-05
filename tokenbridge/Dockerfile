FROM node:16-bullseye-slim
RUN apt-get update && \
    apt-get install -y git docker.io python3 chromium build-essential
WORKDIR /workspace  
RUN git clone https://github.com/OffchainLabs/token-bridge-contracts.git ./
RUN git checkout 49284a490df431b4f0733216b65dc168aa302cc4
RUN yarn install
RUN yarn build
ENTRYPOINT ["yarn"]
