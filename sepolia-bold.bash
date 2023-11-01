#!/usr/bin/env bash

set -e

mydir=`dirname $0`
cd "$mydir"

if ! which docker-compose > /dev/null; then
    echo == Error! docker-compose not installed
    echo please install docker-compose and have it in PATH
    echo see https://docs.docker.com/compose/install/
    exit 1
fi

NODES="sequencer poster"

if ! [ -n "${NITRO_SRC+set}" ]; then
    NITRO_SRC=`dirname $PWD`
fi
if ! grep ^FROM "${NITRO_SRC}/Dockerfile" | grep nitro-node 2>&1 > /dev/null; then
    echo nitro source not found in "$NITRO_SRC"
    echo execute from a sub-directory of nitro or use NITRO_SRC environment variable
    exit 1
fi
docker build "$NITRO_SRC" -t nitro-node-dev --target nitro-node-dev
docker tag nitro-node-dev:latest nitro-node-dev-testnode
docker-compose build --no-rm $NODES scripts
echo == Removing old data..
docker-compose down

leftoverContainers=`docker container ls -a --filter label=com.docker.compose.project=nitro-testnode -q | xargs echo`
if [ `echo $leftoverContainers | wc -w` -gt 0 ]; then
    docker rm $leftoverContainers
fi

docker volume prune -f --filter label=com.docker.compose.project=nitro-testnode
leftoverVolumes=`docker volume ls --filter label=com.docker.compose.project=nitro-testnode -q | xargs echo`
if [ `echo $leftoverVolumes | wc -w` -gt 0 ]; then
    docker volume rm $leftoverVolumes
fi

docker-compose run --entrypoint sh geth -c "chown -R 1000:1000 /config"

echo == Writing l2 chain config
sequenceraddress="0x7BCD4b1d62De88CeE1C08b785aAdC807c1914531"
docker-compose run scripts write-l2-chain-config --l2owner $sequenceraddress

echo == Deploying L2
ownerpriv="4186cddd403633d6d845bfbefa87dcffc9152eb8373b97b53e5e8e15b918aba6"
l1conn="ws://host.docker.internal:8546"
l1chainid="11155111"

docker-compose run --entrypoint /usr/local/bin/bold-deploy poster --l1conn $l1conn --l1privatekey $ownerpriv --sequencerAddress $sequenceraddress --ownerAddress $sequenceraddress --l1DeployAccount $sequenceraddress --l1deployment /config/deployment.json --wasmrootpath /home/user/target/machines --l1chainid=$l1chainid --l2chainconfig /config/l2_chain_config.json --l2chainname arb-dev-test --l2chaininfo /config/deployed_chain_info.json

docker-compose run --entrypoint sh poster -c "jq [.[]] /config/deployed_chain_info.json > /config/l2_chain_info.json"

echo == Writing configs
docker-compose run scripts write-config --l1url $l1conn --l2owner $sequenceraddress
docker-compose run scripts write-evil-config --l1url $l1conn --l2owner $sequenceraddress

echo == Initializing redis
docker-compose run scripts redis-init --redundancy $redundantsequencers

echo == Setting up sequencer and batch poster
docker-compose up -d $INITIAL_SEQ_NODES

docker-compose up -d $NODES
