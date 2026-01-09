#!/usr/bin/env bash

set -eu

NITRO_NODE_VERSION=offchainlabs/nitro-node:v3.9.2-52e8959
BLOCKSCOUT_VERSION=offchainlabs/blockscout:v1.1.0-0e716c8

# nitro-contract workaround for testnode
# 1. authorizing validator signer key since validator wallet is buggy
#    - gas estimation sent from 0x0000 lead to balance and permission error
DEFAULT_NITRO_CONTRACTS_VERSION="v3.1.0"
DEFAULT_TOKEN_BRIDGE_VERSION="v1.2.5"

# Set default versions if not overriden by provided env vars
: ${NITRO_CONTRACTS_BRANCH:=$DEFAULT_NITRO_CONTRACTS_VERSION}
: ${TOKEN_BRIDGE_BRANCH:=$DEFAULT_TOKEN_BRIDGE_VERSION}
export NITRO_CONTRACTS_BRANCH
export TOKEN_BRIDGE_BRANCH

echo "Using NITRO_CONTRACTS_BRANCH: $NITRO_CONTRACTS_BRANCH"
echo "Using TOKEN_BRIDGE_BRANCH: $TOKEN_BRIDGE_BRANCH"

mydir=`dirname $0`
cd "$mydir"

run_script() {
  docker compose run --rm scripts "$@"
}

if [[ $# -gt 0 ]] && [[ $1 == "script" ]]; then
    shift
    run_script "$@"
    exit $?
fi

num_volumes=`docker volume ls --filter label=com.docker.compose.project=nitro-testnode -q | wc -l`

if [[ $num_volumes -eq 0 ]]; then
    force_init=true
else
    force_init=false
fi

run=true
ci=false
validate=false
detach=false
nowait=false
blockscout=false
tokenbridge=false
l3node=false
consensusclient=false
redundantsequencers=0
l3_custom_fee_token=false
l3_custom_fee_token_pricer=false
l3_token_bridge=false
l3_custom_fee_token_decimals=18
batchposters=1
devprivkey=b6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659
l1chainid=1337
simple=true
l2anytrust=false
l2referenceda=false
l2timeboost=false

# Use the dev versions of nitro/blockscout
dev_nitro=false
dev_blockscout=false
dev_contracts=false

# Rebuild docker images
build_dev_nitro=false
build_dev_blockscout=false
build_utils=false
force_build_utils=false
build_node_images=false

# Create some traffic on L2 and L3 so blocks are reliably produced
l2_traffic=true
l3_traffic=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --init)
            if ! $force_init; then
                echo == Warning! this will remove all previous data
                read -p "are you sure? [y/n]" -n 1 response
                if [[ $response == "y" ]] || [[ $response == "Y" ]]; then
                    force_init=true
                    echo
                else
                    exit 0
                fi
            fi
            build_utils=true
            build_node_images=true
            shift
            ;;
        --init-force)
            force_init=true
            build_utils=true
            build_node_images=true
            shift
            ;;
        --dev)
            simple=false
            shift
            if [[ $# -eq 0 || $1 == -* ]]; then
                # If no argument after --dev, set both flags to true
                dev_nitro=true
                build_dev_nitro=true
                dev_blockscout=true
                build_dev_blockscout=true
            else
                while [[ $# -gt 0 && $1 != -* ]]; do
                    if [[ $1 == "nitro" ]]; then
                        dev_nitro=true
                        build_dev_nitro=true
                    elif [[ $1 == "blockscout" ]]; then
                        dev_blockscout=true
                        build_dev_blockscout=true
                    fi
                    shift
                done
            fi
            ;;
        --dev-contracts)
            dev_contracts=true
            shift
            ;;
        --ci)
            ci=true
            shift
            ;;
        --build)
            build_dev_nitro=true
            build_dev_blockscout=true
            build_utils=true
            build_node_images=true
            shift
            ;;
        --no-build)
            build_dev_nitro=false
            build_dev_blockscout=false
            build_utils=false
            build_node_images=false
            shift
            ;;
        --build-dev-nitro)
            build_dev_nitro=true
            shift
            ;;
        --no-build-dev-nitro)
            build_dev_nitro=false
            shift
            ;;
        --build-dev-blockscout)
            build_dev_blockscout=true
            shift
            ;;
        --no-build-dev-blockscout)
            build_dev_blockscout=false
            shift
            ;;
        --build-utils)
            build_utils=true
            shift
            ;;
        --no-build-utils)
            build_utils=false
            shift
            ;;
        --force-build-utils)
            force_build_utils=true
            build_utils=true
            shift
            ;;
        --validate)
            simple=false
            validate=true
            shift
            ;;
        --blockscout)
            blockscout=true
            shift
            ;;
        --tokenbridge)
            tokenbridge=true
            shift
            ;;
        --no-tokenbridge)
            tokenbridge=false
            shift
            ;;
        --no-run)
            run=false
            shift
            ;;
        --detach)
            detach=true
            shift
            ;;
        --nowait)
            if ! $detach; then
                echo "Error: --nowait requires --detach to be provided."
                exit 1
            fi
            nowait=true
            shift
            ;;
        --batchposters)
            simple=false
            batchposters=$2
            if ! [[ $batchposters =~ [0-3] ]] ; then
                echo "batchposters must be between 0 and 3 value:$batchposters."
                exit 1
            fi
            shift
            shift
            ;;
        --pos)
            consensusclient=true
            l1chainid=1337
            shift
            ;;
        --l3node)
            l3node=true
            shift
            ;;
        --l3-fee-token)
            if ! $l3node; then
                echo "Error: --l3-fee-token requires --l3node to be provided."
                exit 1
            fi
            l3_custom_fee_token=true
            shift
            ;;
        --l3-fee-token-pricer)
            if ! $l3_custom_fee_token; then
                echo "Error: --l3-fee-token-pricer requires --l3-fee-token to be provided."
                exit 1
            fi
            l3_custom_fee_token_pricer=true
            shift
            ;;
        --l3-fee-token-decimals)
            if ! $l3_custom_fee_token; then
                echo "Error: --l3-fee-token-decimals requires --l3-fee-token to be provided."
                exit 1
            fi
            l3_custom_fee_token_decimals=$2
            if [[ $l3_custom_fee_token_decimals -lt 0 || $l3_custom_fee_token_decimals -gt 36 ]]; then
                echo "l3-fee-token-decimals must be in range [0,36], value: $l3_custom_fee_token_decimals."
                exit 1
            fi
            shift
            shift
            ;;
        --l3-token-bridge)
            if ! $l3node; then
                echo "Error: --l3-token-bridge requires --l3node to be provided."
                exit 1
            fi
            l3_token_bridge=true
            shift
            ;;
        --l2-anytrust)
            l2anytrust=true
            shift
            ;;
        --l2-referenceda)
            l2referenceda=true
            shift
            ;;
        --l2-timeboost)
            l2timeboost=true
            shift
            ;;
        --redundantsequencers)
            simple=false
            redundantsequencers=$2
            if ! [[ $redundantsequencers =~ [0-3] ]] ; then
                echo "redundantsequencers must be between 0 and 3 value:$redundantsequencers."
                exit 1
            fi
            shift
            shift
            ;;
        --simple)
            simple=true
            shift
            ;;
        --no-simple)
            simple=false
            shift
            ;;
        --no-l2-traffic)
            l2_traffic=false
            shift
            ;;
        --no-l3-traffic)
            l3_traffic=false
            shift
            ;;
        *)
            echo Usage: $0 \[OPTIONS..]
            echo        $0 script [SCRIPT-ARGS]
            echo
            echo OPTIONS:
            echo --build           rebuild docker images
            echo --no-build        don\'t rebuild docker images
            echo --dev             build nitro and blockscout dockers from source instead of pulling them. Disables simple mode
            echo --dev-contracts   build scripts with local development version of contracts
            echo --init            remove all data, rebuild, deploy new rollup
            echo --pos             l1 is a proof-of-stake chain \(using prysm for consensus\)
            echo --validate        heavy computation, validating all blocks in WASM
            echo --l3node          deploys an L3 node on top of the L2
            echo --l3-fee-token    L3 chain is set up to use custom fee token. Only valid if also '--l3node' is provided
            echo --l3-fee-token-decimals Number of decimals to use for custom fee token. Only valid if also '--l3-fee-token' is provided
            echo --l3-token-bridge Deploy L2-L3 token bridge. Only valid if also '--l3node' is provided
            echo --l2-anytrust     run the L2 as an AnyTrust chain
            echo --l2-referenceda  run the L2 with reference external data availability provider
            echo --l2-timeboost    run the L2 with Timeboost enabled, including auctioneer and bid validator
            echo --batchposters    batch posters [0-3]
            echo --redundantsequencers redundant sequencers [0-3]
            echo --detach          detach from nodes after running them
            echo --blockscout      build or launch blockscout
            echo --simple          run a simple configuration. one node as sequencer/batch-poster/staker \(default unless using --dev\)
            echo --tokenbridge     deploy L1-L2 token bridge.
            echo --no-tokenbridge  don\'t build or launch tokenbridge
            echo --no-run          does not launch nodes \(useful with build or init\)
            echo --no-l2-traffic   disables L2 spam transaction traffic \(default: enabled\)
            echo --no-l3-traffic   disables L3 spam transaction traffic \(default: enabled\)
            echo --no-simple       run a full configuration with separate sequencer/batch-poster/validator/relayer
            echo --build-dev-nitro     rebuild dev nitro docker image
            echo --no-build-dev-nitro  don\'t rebuild dev nitro docker image
            echo --build-dev-blockscout     rebuild dev blockscout docker image
            echo --no-build-dev-blockscout  don\'t rebuild dev blockscout docker image
            echo --build-utils         rebuild scripts, rollupcreator, token bridge docker images
            echo --no-build-utils      don\'t rebuild scripts, rollupcreator, token bridge docker images
            echo --force-build-utils   force rebuilding utils, useful if NITRO_CONTRACTS_BRANCH or TOKEN_BRIDGE_BRANCH changes
            echo
            echo script runs inside a separate docker. For SCRIPT-ARGS, run $0 script --help
            exit 0
    esac
done

NODES="sequencer"
INITIAL_SEQ_NODES="sequencer"

if ! $simple; then
    NODES="$NODES redis"
fi
if [ $redundantsequencers -gt 0 ]; then
    NODES="$NODES sequencer_b"
    INITIAL_SEQ_NODES="$INITIAL_SEQ_NODES sequencer_b"
fi
if [ $redundantsequencers -gt 1 ]; then
    NODES="$NODES sequencer_c"
fi
if [ $redundantsequencers -gt 2 ]; then
    NODES="$NODES sequencer_d"
fi

if [ $batchposters -gt 0 ] && ! $simple; then
    NODES="$NODES poster"
fi
if [ $batchposters -gt 1 ]; then
    NODES="$NODES poster_b"
fi
if [ $batchposters -gt 2 ]; then
    NODES="$NODES poster_c"
fi

if $l2anytrust && $l2referenceda; then
    echo "Error: --l2-anytrust and --l2-referenceda cannot be enabled at the same time."
    exit 1
fi

if $validate; then
    NODES="$NODES validator"
elif ! $simple; then
    NODES="$NODES staker-unsafe"
fi
if $l3node; then
    NODES="$NODES l3node"
fi
if $blockscout; then
    NODES="$NODES blockscout"
fi

if $l2timeboost; then
    NODES="$NODES timeboost-auctioneer timeboost-bid-validator"
fi

if $dev_nitro && $build_dev_nitro; then
  echo == Building Nitro
  if ! [ -n "${NITRO_SRC+set}" ]; then
      NITRO_SRC=`dirname $PWD`
  fi
  if ! grep ^FROM "${NITRO_SRC}/Dockerfile" | grep nitro-node 2>&1 > /dev/null; then
      echo nitro source not found in "$NITRO_SRC"
      echo execute from a sub-directory of nitro or use NITRO_SRC environment variable
      exit 1
  fi
  docker build "$NITRO_SRC" -t nitro-node-dev --target nitro-node-dev
fi
if $dev_blockscout && $build_dev_blockscout; then
  if $blockscout; then
    echo == Building Blockscout
    docker build blockscout -t blockscout -f blockscout/docker/Dockerfile
  fi
fi

if $build_utils; then
  LOCAL_BUILD_NODES="scripts rollupcreator"
  # always build tokenbridge in CI mode to avoid caching issues
  if $tokenbridge || $l3_token_bridge || $ci; then
    LOCAL_BUILD_NODES="$LOCAL_BUILD_NODES tokenbridge"
  fi

  if [ "$ci" == true ]; then
    docker buildx bake --allow=fs=/tmp --file docker-compose.yaml --file docker-compose-ci-cache.json $LOCAL_BUILD_NODES
  else
    UTILS_NOCACHE=""
    if $force_build_utils; then
      UTILS_NOCACHE="--no-cache"
    fi
    docker compose build --no-rm $UTILS_NOCACHE $LOCAL_BUILD_NODES
  fi
fi

if $dev_nitro; then
  docker tag nitro-node-dev:latest nitro-node-dev-testnode
else
  docker pull $NITRO_NODE_VERSION
  docker tag $NITRO_NODE_VERSION nitro-node-dev-testnode
fi

if $blockscout; then
  if $dev_blockscout; then
    docker tag blockscout:latest blockscout-testnode
  else
    docker pull $BLOCKSCOUT_VERSION
    docker tag $BLOCKSCOUT_VERSION blockscout-testnode
  fi
fi

if $build_node_images; then
    docker compose build --no-rm $NODES
fi

if $force_init; then
    echo == Removing old data..
    docker compose down
    leftoverContainers=`docker container ls -a --filter label=com.docker.compose.project=nitro-testnode -q | xargs echo`
    if [ `echo $leftoverContainers | wc -w` -gt 0 ]; then
        docker rm $leftoverContainers
    fi
    docker volume prune -f --filter label=com.docker.compose.project=nitro-testnode
    leftoverVolumes=`docker volume ls --filter label=com.docker.compose.project=nitro-testnode -q | xargs echo`
    if [ `echo $leftoverVolumes | wc -w` -gt 0 ]; then
        docker volume rm $leftoverVolumes
    fi

    echo == Generating l1 keys
    run_script write-accounts
    docker compose run --rm --entrypoint sh geth -c "echo passphrase > /datadir/passphrase"
    docker compose run --rm --entrypoint sh geth -c "chown -R 1000:1000 /keystore"
    docker compose run --rm --entrypoint sh geth -c "chown -R 1000:1000 /config"

    echo == Writing geth configs
    run_script write-geth-genesis-config

    if $consensusclient; then
      echo == Writing prysm configs
      run_script write-prysm-config

      echo == Creating prysm genesis
      docker compose run --rm create_beacon_chain_genesis
    fi

    echo == Initializing go-ethereum genesis configuration
    docker compose run --rm geth init --state.scheme hash --datadir /datadir/ /config/geth_genesis.json

    if $consensusclient; then
      echo == Running prysm
      docker compose up --wait prysm_beacon_chain
      docker compose up --wait prysm_validator
    fi

    echo == Starting geth
    docker compose up --wait geth

    echo == Waiting for geth to sync
    run_script wait-for-sync --url http://geth:8545

    echo == Funding validator, sequencer and l2owner
    run_script send-l1 --ethamount 1000 --to validator --wait
    run_script send-l1 --ethamount 1000 --to sequencer --wait
    run_script send-l1 --ethamount 1000 --to l2owner --wait

    echo == create l1 traffic
    run_script send-l1 --ethamount 1000 --to user_l1user --wait
    run_script send-l1 --ethamount 0.0001 --from user_l1user --to user_l1user --wait --delay 1000 --times 1000000 > /dev/null &

    l2ownerAddress=`run_script print-address --account l2owner | tail -n 1 | tr -d '\r\n'`

    if $l2anytrust; then
        echo "== Writing l2 chain config (anytrust enabled)"
        run_script --l2owner $l2ownerAddress write-l2-chain-config --anytrust
    else
        echo "== Writing l2 chain config"
        run_script --l2owner $l2ownerAddress write-l2-chain-config
    fi

    sequenceraddress=`run_script print-address --account sequencer | tail -n 1 | tr -d '\r\n'`
    l2ownerKey=`run_script print-private-key --account l2owner | tail -n 1 | tr -d '\r\n'`
    wasmroot=`docker compose run --rm --entrypoint sh sequencer -c "cat /home/user/target/machines/latest/module-root.txt"`

    echo "== Deploying L2 chain"
    docker compose run --rm -e PARENT_CHAIN_RPC="http://geth:8545" -e DEPLOYER_PRIVKEY=$l2ownerKey -e PARENT_CHAIN_ID=$l1chainid -e CHILD_CHAIN_NAME="arb-dev-test" -e MAX_DATA_SIZE=117964 -e OWNER_ADDRESS=$l2ownerAddress -e WASM_MODULE_ROOT=$wasmroot -e SEQUENCER_ADDRESS=$sequenceraddress -e AUTHORIZE_VALIDATORS=10 -e CHILD_CHAIN_CONFIG_PATH="/config/l2_chain_config.json" -e CHAIN_DEPLOYMENT_INFO="/config/deployment.json" -e CHILD_CHAIN_INFO="/config/deployed_chain_info.json" rollupcreator create-rollup-testnode
    if $l2timeboost; then
        docker compose run --rm --entrypoint sh rollupcreator -c 'jq ".[] | .\"track-block-metadata-from\"=1 | [.]" /config/deployed_chain_info.json > /config/l2_chain_info.json'
    else
        docker compose run --rm --entrypoint sh rollupcreator -c "jq [.[]] /config/deployed_chain_info.json > /config/l2_chain_info.json"
    fi

    if $l2referenceda; then
        docker compose run --rm --entrypoint sh referenceda-provider -c "true" # Noop to mount shared volumes with contracts for manual build and deployment

        echo "== Generating Reference DA keys"
        docker compose run --rm --user root --entrypoint sh datool -c "mkdir /referenceda-provider/keys && chown -R 1000:1000 /referenceda-provider*"
        docker compose run --rm datool keygen --dir /referenceda-provider/keys --ecdsa

        referenceDASignerAddress=`docker compose run --rm --entrypoint sh rollupcreator -c "cat /referenceda-provider/keys/ecdsa.pub | sed 's/^04/0x/' | tr -d '\n' | cast keccak | tail -c 41 | cast to-check-sum-address"`

        echo "== Deploying Reference DA Proof Validator contract on L2"
        l2referenceDAValidatorAddress=`docker compose run --rm --entrypoint sh rollupcreator -c "cd /contracts-local && forge create src/osp/ReferenceDAProofValidator.sol:ReferenceDAProofValidator --rpc-url http://geth:8545 --private-key $l2ownerKey --broadcast --constructor-args [$referenceDASignerAddress]" | awk '/Deployed to:/ {print $NF}'`

        echo "== Generating Reference DA Config"
        run_script write-l2-referenceda-config --validator-address $l2referenceDAValidatorAddress
    fi

fi # $force_init

anytrustNodeConfigLine=""
referenceDaNodeConfigLine=""
timeboostNodeConfigLine=""

# Remaining init may require AnyTrust committee/mirrors to have been started
if $l2anytrust; then
    if $force_init; then
        echo == Generating AnyTrust Config
        docker compose run --rm --user root --entrypoint sh datool -c "mkdir /das-committee-a/keys /das-committee-a/data /das-committee-a/metadata /das-committee-b/keys /das-committee-b/data /das-committee-b/metadata /das-mirror/data /das-mirror/metadata"
        docker compose run --rm --user root --entrypoint sh datool -c "chown -R 1000:1000 /das*"
        docker compose run --rm datool keygen --dir /das-committee-a/keys
        docker compose run --rm datool keygen --dir /das-committee-b/keys
        run_script write-l2-das-committee-config
        run_script write-l2-das-mirror-config

        das_bls_a=`docker compose run --rm --entrypoint sh datool -c "cat /das-committee-a/keys/das_bls.pub"`
        das_bls_b=`docker compose run --rm --entrypoint sh datool -c "cat /das-committee-b/keys/das_bls.pub"`

        run_script write-l2-das-keyset-config --dasBlsA $das_bls_a --dasBlsB $das_bls_b
        docker compose run --rm --entrypoint sh datool -c "/usr/local/bin/datool dumpkeyset --conf.file /config/l2_das_keyset.json | grep 'Keyset: ' | awk '{ printf \"%s\", \$2 }' > /config/l2_das_keyset.hex"
        run_script set-valid-keyset

        anytrustNodeConfigLine="--anytrust --dasBlsA $das_bls_a --dasBlsB $das_bls_b"
    fi

    if $run; then
        echo == Starting AnyTrust committee and mirror
        docker compose up --wait das-committee-a das-committee-b das-mirror
    fi
fi

if $l2referenceda && $run; then
    echo "== Starting Reference DA service"
    docker compose up --wait referenceda-provider
fi

if $force_init; then
    if $l2timeboost; then
        timeboostNodeConfigLine="--timeboost"
    fi
    if $l2referenceda; then
        referenceDaNodeConfigLine="--referenceDA"
    fi

    echo "== Writing configs"
    if $simple; then
        run_script write-config --simple $anytrustNodeConfigLine $referenceDaNodeConfigLine $timeboostNodeConfigLine
    else
        run_script write-config $anytrustNodeConfigLine $referenceDaNodeConfigLine $timeboostNodeConfigLine

        echo == Initializing redis
        docker compose up --wait redis
        run_script redis-init --redundancy $redundantsequencers
    fi

    echo == Funding l2 funnel and dev key
    docker compose up --wait $INITIAL_SEQ_NODES
    sleep 45 # in case we need to create a smart contract wallet, allow for parent chain to recieve the contract creation tx and process it
    run_script bridge-funds --ethamount 100000 --wait
    run_script send-l2 --ethamount 100 --to l2owner --wait
    rollupAddress=`docker compose run --rm --entrypoint sh poster -c "jq -r '.[0].rollup.rollup' /config/deployed_chain_info.json | tail -n 1 | tr -d '\r\n'"`

    if $l2timeboost; then
        run_script send-l2 --ethamount 100 --to auctioneer --wait
        biddingTokenAddress=`run_script create-erc20 --deployer auctioneer | tail -n 1 | awk '{ print $NF }'`
        auctionContractAddress=`run_script deploy-express-lane-auction --bidding-token $biddingTokenAddress | tail -n 1 | awk '{ print $NF }'`
        auctioneerAddress=`run_script print-address --account auctioneer | tail -n1 | tr -d '\r\n'`
        echo == Starting up Timeboost auctioneer and bid validator.
        echo == Bidding token: $biddingTokenAddress, auction contract $auctionContractAddress
        run_script write-timeboost-configs --auction-contract $auctionContractAddress
        docker compose run --rm --user root --entrypoint sh timeboost-auctioneer -c "chown -R 1000:1000 /data"

        echo == Funding alice and bob user accounts for timeboost testing
        run_script send-l2 --ethamount 10 --to user_alice --wait
        run_script send-l2 --ethamount 10 --to user_bob --wait
        run_script transfer-erc20 --token $biddingTokenAddress --amount 10000 --from auctioneer --to user_alice
        run_script transfer-erc20 --token $biddingTokenAddress --amount 10000 --from auctioneer --to user_bob

        docker compose run --rm --entrypoint sh scripts -c "sed -i 's/\(\"execution\":{\"sequencer\":{\"enable\":true,\"timeboost\":{\"enable\":\)false/\1true,\"auction-contract-address\":\"$auctionContractAddress\",\"auctioneer-address\":\"$auctioneerAddress\"/' /config/sequencer_config.json" --wait
        docker compose restart $INITIAL_SEQ_NODES
    fi

    if $tokenbridge; then
        echo == Deploying L1-L2 token bridge
        sleep 10 # no idea why this sleep is needed but without it the deploy fails randomly
        docker compose run --rm -e ROLLUP_OWNER_KEY=$l2ownerKey -e ROLLUP_ADDRESS=$rollupAddress -e PARENT_KEY=$devprivkey -e PARENT_RPC=http://geth:8545 -e CHILD_KEY=$devprivkey -e CHILD_RPC=http://sequencer:8547 tokenbridge deploy:local:token-bridge
        docker compose run --rm --entrypoint sh tokenbridge -c "cat network.json && cp network.json l1l2_network.json && cp network.json localNetwork.json"
        echo
    fi

    echo == Deploy CacheManager on L2
    docker compose run --rm -e CHILD_CHAIN_RPC="http://sequencer:8547" -e CHAIN_OWNER_PRIVKEY=$l2ownerKey rollupcreator deploy-cachemanager-testnode

    echo == Deploy Stylus Deployer on L2
    run_script create-stylus-deployer --deployer l2owner

    # TODO: remove this once the gas estimation issue is fixed
    echo == Gas Estimation workaround
    run_script send-l1 --ethamount 1 --to address_0x0000000000000000000000000000000000000000 --wait
    run_script send-l2 --ethamount 1 --to address_0x0000000000000000000000000000000000000000 --wait

    if $l2_traffic; then
        echo == create l2 traffic
        run_script send-l2 --ethamount 100 --to user_traffic_generator --wait
        run_script send-l2 --ethamount 0.0001 --from user_traffic_generator --to user_traffic_generator --wait --delay 500 --times 1000000 > /dev/null &
    fi

    if $l3node; then
        echo == Funding l3 users
        run_script send-l2 --ethamount 1000 --to validator --wait
        run_script send-l2 --ethamount 1000 --to l3owner --wait
        run_script send-l2 --ethamount 1000 --to l3sequencer --wait

        echo == Funding l2 deployers
        run_script send-l1 --ethamount 100 --to user_token_bridge_deployer --wait
        run_script send-l2 --ethamount 100 --to user_token_bridge_deployer --wait

        echo == Funding token deployer
        run_script send-l1 --ethamount 100 --to user_fee_token_deployer --wait
        run_script send-l2 --ethamount 100 --to user_fee_token_deployer --wait

        echo == Writing l3 chain config
        l3owneraddress=`run_script print-address --account l3owner | tail -n 1 | tr -d '\r\n'`
        echo l3owneraddress $l3owneraddress
        run_script --l2owner $l3owneraddress  write-l3-chain-config

        EXTRA_L3_DEPLOY_FLAG=""
        if $l3_custom_fee_token; then
            echo == Deploying custom fee token
            nativeTokenAddress=`run_script create-erc20 --deployer user_fee_token_deployer --bridgeable $tokenbridge --decimals $l3_custom_fee_token_decimals | tail -n 1 | awk '{ print $NF }'`
            run_script transfer-erc20 --token $nativeTokenAddress --amount 10000 --from user_fee_token_deployer --to l3owner
            run_script transfer-erc20 --token $nativeTokenAddress --amount 10000 --from user_fee_token_deployer --to user_token_bridge_deployer
            EXTRA_L3_DEPLOY_FLAG="-e FEE_TOKEN_ADDRESS=$nativeTokenAddress"
            if $l3_custom_fee_token_pricer; then
                echo == Deploying custom fee token pricer
                feeTokenPricerAddress=`run_script create-fee-token-pricer --deployer user_fee_token_deployer | tail -n 1 | awk '{ print $NF }'`
                EXTRA_L3_DEPLOY_FLAG="$EXTRA_L3_DEPLOY_FLAG -e FEE_TOKEN_PRICER_ADDRESS=$feeTokenPricerAddress"
            fi
        fi

        echo == Deploying L3
        l3ownerkey=`run_script print-private-key --account l3owner | tail -n 1 | tr -d '\r\n'`
        l3sequenceraddress=`run_script print-address --account l3sequencer | tail -n 1 | tr -d '\r\n'`

        docker compose run --rm -e DEPLOYER_PRIVKEY=$l3ownerkey -e PARENT_CHAIN_RPC="http://sequencer:8547" -e PARENT_CHAIN_ID=412346 -e CHILD_CHAIN_NAME="orbit-dev-test" -e MAX_DATA_SIZE=104857 -e OWNER_ADDRESS=$l3owneraddress -e WASM_MODULE_ROOT=$wasmroot -e SEQUENCER_ADDRESS=$l3sequenceraddress -e AUTHORIZE_VALIDATORS=10 -e CHILD_CHAIN_CONFIG_PATH="/config/l3_chain_config.json" -e CHAIN_DEPLOYMENT_INFO="/config/l3deployment.json" -e CHILD_CHAIN_INFO="/config/deployed_l3_chain_info.json" $EXTRA_L3_DEPLOY_FLAG rollupcreator create-rollup-testnode
        docker compose run --rm --entrypoint sh rollupcreator -c "jq [.[]] /config/deployed_l3_chain_info.json > /config/l3_chain_info.json"

        echo == Funding l3 funnel and dev key
        docker compose up --wait l3node sequencer
        sleep 45 # in case we need to create a smart contract wallet, allow for parent chain to recieve the contract creation tx and process it

        if $l3_token_bridge; then
            echo == Deploying L2-L3 token bridge
            deployer_key=`printf "%s" "user_token_bridge_deployer" | openssl dgst -sha256 | sed 's/^.*= //'`
            rollupAddress=`docker compose run --rm --entrypoint sh poster -c "jq -r '.[0].rollup.rollup' /config/deployed_l3_chain_info.json | tail -n 1 | tr -d '\r\n'"`
            l2Weth=""
            if $tokenbridge; then
                # we deployed an L1 L2 token bridge
                # we need to pull out the L2 WETH address and pass it as an override to the L2 L3 token bridge deployment
                l2Weth=`docker compose run --rm --entrypoint sh tokenbridge -c "cat l1l2_network.json" | jq -r '.l2Network.tokenBridge.childWeth'`
            fi
            docker compose run --rm -e PARENT_WETH_OVERRIDE=$l2Weth -e ROLLUP_OWNER_KEY=$l3ownerkey -e ROLLUP_ADDRESS=$rollupAddress -e PARENT_RPC=http://sequencer:8547 -e PARENT_KEY=$deployer_key  -e CHILD_RPC=http://l3node:3347 -e CHILD_KEY=$deployer_key tokenbridge deploy:local:token-bridge
            docker compose run --rm --entrypoint sh tokenbridge -c "cat network.json && cp network.json l2l3_network.json"

            # set L3 UpgradeExecutor, deployed by token bridge creator in previous step, to be the L3 chain owner. L3owner (EOA) and alias of L2 UpgradeExectuor have the executor role on the L3 UpgradeExecutor
            echo == Set L3 UpgradeExecutor to be chain owner
            tokenBridgeCreator=`docker compose run --rm --entrypoint sh tokenbridge -c "cat l2l3_network.json" | jq -r '.l1TokenBridgeCreator'`
            run_script transfer-l3-chain-ownership --creator $tokenBridgeCreator
            echo
        fi

        echo == Fund L3 accounts
        if $l3_custom_fee_token; then
            run_script bridge-native-token-to-l3 --amount 5000 --from user_fee_token_deployer --wait
            run_script send-l3 --ethamount 100 --from user_fee_token_deployer --wait
        else
            run_script bridge-to-l3 --ethamount 50000 --wait
        fi
        run_script send-l3 --ethamount 10 --to l3owner --wait

        echo == Deploy CacheManager on L3
        docker compose run --rm -e CHILD_CHAIN_RPC="http://l3node:3347" -e CHAIN_OWNER_PRIVKEY=$l3ownerkey rollupcreator deploy-cachemanager-testnode

        echo == Deploy Stylus Deployer on L3
        run_script create-stylus-deployer --deployer l3owner --l3

        if $l3_traffic; then
            echo == create l3 traffic
            run_script send-l3 --ethamount 10 --to user_traffic_generator --wait
            run_script send-l3 --ethamount 0.0001 --from user_traffic_generator --to user_traffic_generator --wait --delay 5000 --times 1000000 > /dev/null &
        fi
    fi
fi

if $run; then
    UP_FLAG=""
    if $detach; then
        if $nowait; then
            UP_FLAG="--detach"
        else
            UP_FLAG="--wait"
        fi
    fi

    echo == Launching Sequencer
    echo if things go wrong - use --init to create a new chain
    echo

    docker compose up $UP_FLAG $NODES
fi
