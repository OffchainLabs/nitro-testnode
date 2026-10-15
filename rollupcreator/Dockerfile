FROM node:20-trixie-slim
RUN apt-get update && \
    apt-get install -y git docker.io python3 make gcc g++ curl jq
ARG NITRO_CONTRACTS_BRANCH=main
WORKDIR /workspace  
RUN git clone --no-checkout https://github.com/OffchainLabs/nitro-contracts.git ./
RUN git checkout ${NITRO_CONTRACTS_BRANCH}
RUN git submodule update --init --recursive
RUN yarn install && yarn cache clean
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup_version=v0.0.8 && \
    arch=$(dpkg --print-architecture) && \
    case "$arch" in \
      amd64) foundryup_sha256=6ff7da0c8ad82b138c9e37b7598e65f99878bda7522aede4617f585bda0d846f ;; \
      arm64) foundryup_sha256=60d5170d91409d144492778ea982266e746419abcbf7ac117a08ee93ee01e032 ;; \
      *) echo "no foundryup checksum for $arch" >&2; exit 1 ;; \
    esac && \
    mkdir -p /root/.foundry/bin && \
    curl --proto '=https' --tlsv1.2 -fsSL --retry 3 -o /root/.foundry/bin/foundryup \
      "https://github.com/foundry-rs/foundryup/releases/download/${foundryup_version}/foundryup_linux_${arch}" && \
    echo "${foundryup_sha256}  /root/.foundry/bin/foundryup" | sha256sum -c - && \
    chmod +x /root/.foundry/bin/foundryup && \
    foundryup --install 1.0.0
RUN touch scripts/config.ts
RUN yarn build:all
ENTRYPOINT ["yarn"]
