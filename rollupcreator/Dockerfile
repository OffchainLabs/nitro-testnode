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
RUN foundry_version=v1.0.0 && \
    arch=$(dpkg --print-architecture) && \
    case "$arch" in \
      amd64) foundry_sha256=8c078eaced6bfce76af902def65e36db677842ffbf53f76730647082a5b1e45a ;; \
      arm64) foundry_sha256=79967815024de284265b9e82b75498b46357e597b93b481b9f4abe88a53eade6 ;; \
      *) echo "no Foundry checksum for $arch" >&2; exit 1 ;; \
    esac && \
    tarball=foundry_${foundry_version}_linux_${arch}.tar.gz && \
    curl --proto '=https' --tlsv1.2 -fsSL --retry 3 -o "/tmp/$tarball" \
      "https://github.com/foundry-rs/foundry/releases/download/${foundry_version}/$tarball" && \
    echo "${foundry_sha256}  /tmp/$tarball" | sha256sum -c - && \
    mkdir -p /root/.foundry/bin && \
    tar -xzf "/tmp/$tarball" -C /root/.foundry/bin && \
    rm "/tmp/$tarball"
RUN touch scripts/config.ts
RUN yarn build:all
ENTRYPOINT ["yarn"]
