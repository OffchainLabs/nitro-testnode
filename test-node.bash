#!/usr/bin/env bash

set -euo pipefail

: "${NITRO_NODE_VERSION:=offchainlabs/nitro-node:v3.9.8-4624977}"
: "${BLOCKSCOUT_VERSION:=offchainlabs/blockscout:v1.1.0-0e716c8}"

# nitro-contract workaround for testnode
# 1. authorizing validator signer key since validator wallet is buggy
#    - gas estimation sent from 0x0000 lead to balance and permission error
DEFAULT_NITRO_CONTRACTS_VERSION="v3.1.0"
DEFAULT_TOKEN_BRIDGE_VERSION="v1.2.5"

# Set default versions if not overridden by provided env vars
: "${NITRO_CONTRACTS_BRANCH:=$DEFAULT_NITRO_CONTRACTS_VERSION}"
: "${TOKEN_BRIDGE_BRANCH:=$DEFAULT_TOKEN_BRIDGE_VERSION}"
export NITRO_CONTRACTS_BRANCH
export TOKEN_BRIDGE_BRANCH

echo "Using NITRO_CONTRACTS_BRANCH: $NITRO_CONTRACTS_BRANCH"
echo "Using TOKEN_BRIDGE_BRANCH: $TOKEN_BRIDGE_BRANCH"

mydir=$(dirname "$0")
cd "$mydir"

run_script() {
  docker compose run --rm scripts "$@"
}

# Capture the last line of output from a command, failing if empty.
# On failure, exits the subshell with status 1. Because callers use simple
# assignment (var=$(...)), set -e propagates the failure. Do NOT use in
# conditionals (if/||/&&) or with `local` on the same line
# (local var=$(...)) -- both silently swallow failures.
# Usage: var=$(capture_output run_script print-address --account foo)
capture_output() {
  local full_output
  full_output=$("$@") || {
    echo "Error: command failed: $*" >&2
    if [ -n "$full_output" ]; then
      echo "Stdout was:" >&2
      echo "$full_output" >&2
    fi
    exit 1
  }
  local output
  output=$(echo "$full_output" | tail -n 1 | tr -d '\r\n')
  if [ -z "$output" ]; then
    echo "Error: empty output from command: $*" >&2
    echo "Full output was:" >&2
    echo "$full_output" >&2
    exit 1
  fi
  echo "$output"
}

# Capture the last whitespace-delimited field from the last line of command output.
# On failure, exits the subshell with status 1. Because callers use simple
# assignment (var=$(...)), set -e propagates the failure. Do NOT use in
# conditionals (if/||/&&) or with `local` on the same line
# (local var=$(...)) -- both silently swallow failures.
# Usage: var=$(capture_last_field run_script create-erc20 --deployer foo)
capture_last_field() {
  local output
  output=$(capture_output "$@")
  local field
  field=$(echo "$output" | awk '{ print $NF }')
  if [ -z "$field" ]; then
    echo "Error: failed to extract last field from output: $output" >&2
    echo "Command was: $*" >&2
    exit 1
  fi
  echo "$field"
}

# Verify a value is non-null and non-empty, with a descriptive error on failure.
# Usage: require_non_null "$var" "rollup address from deployed_chain_info.json"
require_non_null() {
  local value=$1 description=$2
  if [ "$value" = "null" ] || [ -z "$value" ]; then
    echo "Error: failed to extract $description" >&2
    exit 1
  fi
}

# Wrapper for docker compose up --wait that adds diagnostic guidance on failure.
docker_up_wait() {
  docker compose up --wait "$@" || {
    echo "Error: service(s) failed to become healthy: $*" >&2
    echo "Check logs with: docker compose logs $*" >&2
    exit 1
  }
}

# Wait for chain to produce blocks, confirming readiness.
# Usage: wait_for_chain_progress <send_command> <chain_name>
# e.g.: wait_for_chain_progress "send-l1" "L1"
wait_for_chain_progress() {
  local cmd=$1
  local chain=$2
  local max_attempts=60
  local last_err=""
  echo "== Waiting for $chain block production..."
  for attempt in $(seq 1 "$max_attempts"); do
    # Discard noisy stdout from run_script; capture only stderr for diagnostics
    if last_err=$( { run_script "$cmd" --ethamount 0.0001 --to address_0x0000000000000000000000000000000000000000 --wait > /dev/null; } 2>&1 ); then
      return 0
    fi
    # Check for known non-transient errors (abort), known transient errors
    # (retry silently), and unknown errors (warn but retry).
    case "$last_err" in
      *"container"*"not found"*|*"Cannot connect to the Docker"*|*"no such service"*|*"build"*"failed"*)
        echo "Error: $chain send failed with non-transient error:" >&2
        echo "$last_err" >&2
        exit 1
        ;;
      *"connection refused"*|*"ECONNRESET"*|*"nonce too"*|*"already known"*|*"replacement transaction"*|*"EOF"*|*"connection reset"*)
        # Known transient errors; keep retrying silently
        ;;
      *)
        # Unknown error -- warn but continue retrying in case it's transient
        echo "Warning: $chain send encountered unexpected error (attempt $attempt/$max_attempts):" >&2
        echo "$last_err" >&2
        ;;
    esac
    sleep 1
  done
  echo "Error: $chain did not produce blocks after $max_attempts attempts" >&2
  if [ -n "$last_err" ]; then
    echo "Last error: $last_err" >&2
  fi
  exit 1
}

if [[ $# -gt 0 ]] && [[ $1 == "script" ]]; then
    shift
    run_script "$@"
    exit $?
fi

# Track background PIDs for cleanup on exit/signal.
# Registered after the "script" early-exit above so that running
# "./test-node.bash script ..." does not kill scripts containers
# from other terminal sessions.
BACKGROUND_PIDS=()
cleanup_background() {
  if [ ${#BACKGROUND_PIDS[@]} -gt 0 ]; then
    for pid in "${BACKGROUND_PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    for pid in "${BACKGROUND_PIDS[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
  fi
  # Force-stop and remove any remaining scripts containers (orphaned or still running)
  local rm_err
  rm_err=$(docker compose rm -sf scripts 2>&1) || echo "Warning: failed to clean up scripts container: $rm_err" >&2
}
trap cleanup_background EXIT
trap 'cleanup_background; trap - INT; kill -INT $$' INT
trap 'cleanup_background; trap - TERM; kill -TERM $$' TERM

COMPOSE_LABEL_FILTER="label=com.docker.compose.project=nitro-testnode"

num_volumes=$(docker volume ls --filter "$COMPOSE_LABEL_FILTER" -q | wc -l | tr -d ' ')

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
l2txfiltering=false

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
                echo "== Warning! this will remove all previous data"
                read -r -p "are you sure? [y/n]" -n 1 response
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
                    else
                        echo "Error: --dev unknown argument '$1' (expected 'nitro' or 'blockscout')." >&2
                        exit 1
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
            nowait=true
            shift
            ;;
        --batchposters)
            if ! [[ "${2-}" =~ ^[0-3]$ ]]; then
                echo "Error: --batchposters requires a value [0-3]." >&2
                exit 1
            fi
            simple=false
            batchposters=$2
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
            l3_custom_fee_token=true
            shift
            ;;
        --l3-fee-token-pricer)
            l3_custom_fee_token_pricer=true
            shift
            ;;
        --l3-fee-token-decimals)
            if ! [[ "${2-}" =~ ^[0-9]+$ ]] || [[ $2 -gt 36 ]]; then
                echo "Error: --l3-fee-token-decimals requires a value [0-36]." >&2
                exit 1
            fi
            l3_custom_fee_token_decimals=$2
            shift
            shift
            ;;
        --l3-token-bridge)
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
        --l2-tx-filtering)
            l2txfiltering=true
            shift
            ;;
        --redundantsequencers)
            if ! [[ "${2-}" =~ ^[0-3]$ ]]; then
                echo "Error: --redundantsequencers requires a value [0-3]." >&2
                exit 1
            fi
            simple=false
            redundantsequencers=$2
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
            cat <<HELP
Usage: $0 [OPTIONS..]
       $0 script [SCRIPT-ARGS]

OPTIONS:
--build                    rebuild docker images
--no-build                 don't rebuild docker images
--dev                      build nitro and blockscout dockers from source instead of pulling them. Disables simple mode
--dev-contracts            build scripts with local development version of contracts
--init                     remove all data, rebuild, deploy new rollup
--init-force               same as --init but skips confirmation prompt
--ci                       optimizations for CI environments (cache-based docker builds)
--pos                      l1 is a proof-of-stake chain (using prysm for consensus)
--validate                 heavy computation, validating all blocks in WASM
--l3node                   deploys an L3 node on top of the L2
--l3-fee-token             L3 chain is set up to use custom fee token. Only valid if also '--l3node' is provided
--l3-fee-token-decimals    Number of decimals to use for custom fee token. Only valid if also '--l3-fee-token' is provided
--l3-fee-token-pricer      deploy a custom fee token pricer for L3 (requires --l3-fee-token)
--l3-token-bridge          Deploy L2-L3 token bridge. Only valid if also '--l3node' is provided
--l2-anytrust              run the L2 as an AnyTrust chain
--l2-referenceda           run the L2 with reference external data availability provider
--l2-timeboost             run the L2 with Timeboost enabled, including auctioneer and bid validator
--l2-tx-filtering          run the L2 with transaction filtering enabled
--batchposters             batch posters [0-3]
--redundantsequencers      redundant sequencers [0-3]
--detach                   detach from nodes after running them
--nowait                   when used with --detach, don't wait for services to be healthy
--blockscout               build or launch blockscout
--simple                   run a simple configuration. one node as sequencer/batch-poster/staker (default unless using --dev)
--tokenbridge              deploy L1-L2 token bridge.
--no-tokenbridge           don't build or launch tokenbridge
--no-run                   does not launch nodes (useful with build or init)
--no-l2-traffic            disables L2 spam transaction traffic (default: enabled)
--no-l3-traffic            disables L3 spam transaction traffic (default: enabled)
--no-simple                run a full configuration with separate sequencer/batch-poster/validator/relayer
--build-dev-nitro          rebuild dev nitro docker image
--no-build-dev-nitro       don't rebuild dev nitro docker image
--build-dev-blockscout     rebuild dev blockscout docker image
--no-build-dev-blockscout  don't rebuild dev blockscout docker image
--build-utils              rebuild scripts, rollupcreator, token bridge docker images
--no-build-utils           don't rebuild scripts, rollupcreator, token bridge docker images
--force-build-utils        force rebuilding utils, useful if NITRO_CONTRACTS_BRANCH or TOKEN_BRIDGE_BRANCH changes

script runs inside a separate docker. For SCRIPT-ARGS, run $0 script --help
HELP
            exit 0
    esac
done

if $nowait && ! $detach; then
    echo "Error: --nowait requires --detach to be provided." >&2
    exit 1
fi
if $l3_custom_fee_token && ! $l3node; then
    echo "Error: --l3-fee-token requires --l3node to be provided." >&2
    exit 1
fi
if $l3_custom_fee_token_pricer && ! $l3_custom_fee_token; then
    echo "Error: --l3-fee-token-pricer requires --l3-fee-token to be provided." >&2
    exit 1
fi
if [[ "$l3_custom_fee_token_decimals" != "18" ]] && ! $l3_custom_fee_token; then
    echo "Error: --l3-fee-token-decimals requires --l3-fee-token to be provided." >&2
    exit 1
fi
if $l3_token_bridge && ! $l3node; then
    echo "Error: --l3-token-bridge requires --l3node to be provided." >&2
    exit 1
fi

NODES=(sequencer)
INITIAL_SEQ_NODES=(sequencer)

if ! $simple; then
    NODES+=(redis)
fi
if [ "$redundantsequencers" -gt 0 ]; then
    NODES+=(sequencer_b)
    INITIAL_SEQ_NODES+=(sequencer_b)
fi
if [ "$redundantsequencers" -gt 1 ]; then
    NODES+=(sequencer_c)
fi
if [ "$redundantsequencers" -gt 2 ]; then
    NODES+=(sequencer_d)
fi

if [ "$batchposters" -gt 0 ] && ! $simple; then
    NODES+=(poster)
fi
if [ "$batchposters" -gt 1 ]; then
    NODES+=(poster_b)
fi
if [ "$batchposters" -gt 2 ]; then
    NODES+=(poster_c)
fi

if $l2anytrust && $l2referenceda; then
    echo "Error: --l2-anytrust and --l2-referenceda cannot be enabled at the same time." >&2
    exit 1
fi

if $validate; then
    NODES+=(validator)
elif ! $simple; then
    NODES+=(staker-unsafe)
fi
if $l3node; then
    NODES+=(l3node)
fi
if $blockscout; then
    NODES+=(blockscout)
fi

if $l2timeboost; then
    NODES+=(timeboost-auctioneer timeboost-bid-validator)
fi

if $l2txfiltering; then
    NODES+=(minio transaction-filterer)
fi

if $dev_nitro && $build_dev_nitro; then
  echo "== Building Nitro"
  if [ -z "${NITRO_SRC+set}" ]; then
      NITRO_SRC=$(dirname "$PWD")
  fi
  if ! grep -q "^FROM.*nitro-node" "${NITRO_SRC}/Dockerfile" 2>/dev/null; then
      echo nitro source not found in "$NITRO_SRC"
      echo execute from a sub-directory of nitro or use NITRO_SRC environment variable
      exit 1
  fi
  docker build "$NITRO_SRC" -t nitro-node-dev --target nitro-node-dev
fi
if $dev_blockscout && $build_dev_blockscout; then
  if $blockscout; then
    echo "== Building Blockscout"
    docker build blockscout -t blockscout -f blockscout/docker/Dockerfile
  fi
fi

if $build_utils; then
  LOCAL_BUILD_NODES=(scripts rollupcreator)
  # always build tokenbridge in CI mode to avoid caching issues
  if $tokenbridge || $l3_token_bridge || $ci; then
    LOCAL_BUILD_NODES+=(tokenbridge)
  fi

  if $ci; then
    docker buildx bake --allow=fs=/tmp --file docker-compose.yaml --file docker-compose-ci-cache.json "${LOCAL_BUILD_NODES[@]}"
  else
    UTILS_NOCACHE=()
    if $force_build_utils; then
      UTILS_NOCACHE=(--no-cache)
    fi
    docker compose build --no-rm ${UTILS_NOCACHE[@]+"${UTILS_NOCACHE[@]}"} "${LOCAL_BUILD_NODES[@]}"
  fi
fi

if $dev_nitro; then
  docker tag nitro-node-dev:latest nitro-node-dev-testnode
else
  docker pull "$NITRO_NODE_VERSION"
  docker tag "$NITRO_NODE_VERSION" nitro-node-dev-testnode
fi

if $blockscout; then
  if $dev_blockscout; then
    docker tag blockscout:latest blockscout-testnode
  else
    docker pull "$BLOCKSCOUT_VERSION"
    docker tag "$BLOCKSCOUT_VERSION" blockscout-testnode
  fi
fi

if $build_node_images; then
    docker compose build --no-rm "${NODES[@]}"
fi

if $force_init; then
    echo "== Removing old data.."
    if ! docker compose down -v --remove-orphans --timeout 10; then
        echo "Warning: 'docker compose down' failed; forcing cleanup of remaining resources" >&2
    fi
    leftoverContainers=$(docker container ls -a --filter "$COMPOSE_LABEL_FILTER" -q)
    if [ -n "$leftoverContainers" ]; then
        echo "$leftoverContainers" | xargs docker rm -f || echo "Warning: failed to remove some containers" >&2
    fi
    # Brief pause to let Docker release volume references after container removal
    leftoverVolumes=$(docker volume ls --filter "$COMPOSE_LABEL_FILTER" -q)
    if [ -n "$leftoverVolumes" ]; then
        sleep 1
        echo "$leftoverVolumes" | xargs docker volume rm -f || echo "Warning: failed to remove some volumes" >&2
    fi
    leftoverNetworks=$(docker network ls --filter "$COMPOSE_LABEL_FILTER" -q)
    if [ -n "$leftoverNetworks" ]; then
        echo "$leftoverNetworks" | xargs docker network rm || echo "Warning: some networks could not be removed (may still be in use)" >&2
    fi

    # Verify cleanup succeeded before proceeding -- stale state causes hard-to-diagnose init failures
    remaining_containers=$(docker container ls -a --filter "$COMPOSE_LABEL_FILTER" -q | wc -l | tr -d ' ')
    remaining_volumes=$(docker volume ls --filter "$COMPOSE_LABEL_FILTER" -q | wc -l | tr -d ' ')
    remaining_networks=$(docker network ls --filter "$COMPOSE_LABEL_FILTER" -q | wc -l | tr -d ' ')
    if [ "$remaining_containers" -gt 0 ] || [ "$remaining_volumes" -gt 0 ] || [ "$remaining_networks" -gt 0 ]; then
        echo "Error: cleanup incomplete -- $remaining_containers containers, $remaining_volumes volumes, and $remaining_networks networks still remain" >&2
        echo "Inspect with: docker container ls -a --filter $COMPOSE_LABEL_FILTER" >&2
        echo "              docker volume ls --filter $COMPOSE_LABEL_FILTER" >&2
        echo "              docker network ls --filter $COMPOSE_LABEL_FILTER" >&2
        echo "To force cleanup, try: docker compose down -v --remove-orphans && docker system prune -f --volumes --filter $COMPOSE_LABEL_FILTER" >&2
        exit 1
    fi

    echo "== Generating l1 keys"
    run_script write-accounts
    docker compose run --rm --entrypoint sh geth -c "echo passphrase > /datadir/passphrase && chown -R 1000:1000 /keystore && chown -R 1000:1000 /config"

    echo "== Writing geth configs"
    run_script write-geth-genesis-config

    if $consensusclient; then
      echo "== Writing prysm configs"
      run_script write-prysm-config

      echo "== Creating prysm genesis"
      docker compose run --rm create_beacon_chain_genesis
    fi

    echo "== Initializing go-ethereum genesis configuration"
    docker compose run --rm geth init --state.scheme hash --datadir /datadir/ /config/geth_genesis.json

    if $consensusclient; then
      echo "== Running prysm"
      docker_up_wait prysm_beacon_chain
      docker_up_wait prysm_validator
    fi

    echo "== Starting geth"
    docker_up_wait geth

    echo "== Waiting for geth to sync"
    run_script wait-for-sync --url http://geth:8545

    if $l2txfiltering; then
        echo "== Starting MinIO"
        docker_up_wait minio

        echo "== Initializing MinIO bucket and address list"
        run_script init-tx-filtering-minio
    fi

    echo "== Funding validator, sequencer and l2owner"
    run_script send-l1 --ethamount 1000 --to validator --wait
    run_script send-l1 --ethamount 1000 --to sequencer --wait
    run_script send-l1 --ethamount 1000 --to l2owner --wait

    echo "== Create l1 traffic"
    run_script send-l1 --ethamount 1000 --to user_l1user --wait
    run_script send-l1 --ethamount 0.0001 --from user_l1user --to user_l1user --wait --delay 1000 --times 1000000 > /dev/null &
    BACKGROUND_PIDS+=($!)

    l2ownerAddress=$(capture_output run_script print-address --account l2owner)

    l2ChainConfigFlags=()
    if $l2anytrust; then
        l2ChainConfigFlags+=(--anytrust)
    fi
    if $l2txfiltering; then
        l2ChainConfigFlags+=(--txfiltering)
    fi

    echo "== Writing l2 chain config"
    run_script --l2owner "$l2ownerAddress" write-l2-chain-config ${l2ChainConfigFlags[@]+"${l2ChainConfigFlags[@]}"}

    sequenceraddress=$(capture_output run_script print-address --account sequencer)
    l2ownerKey=$(capture_output run_script print-private-key --account l2owner)
    wasmroot=$(capture_output docker compose run --rm --entrypoint sh sequencer -c "cat /home/user/target/machines/latest/module-root.txt")

    echo "== Deploying L2 chain"
    docker compose run --rm -e DEPLOYER_PRIVKEY="$l2ownerKey" -e PARENT_CHAIN_RPC="http://geth:8545" -e PARENT_CHAIN_ID="$l1chainid" -e CHILD_CHAIN_NAME="arb-dev-test" -e MAX_DATA_SIZE=117964 -e OWNER_ADDRESS="$l2ownerAddress" -e WASM_MODULE_ROOT="$wasmroot" -e SEQUENCER_ADDRESS="$sequenceraddress" -e AUTHORIZE_VALIDATORS=10 -e CHILD_CHAIN_CONFIG_PATH="/config/l2_chain_config.json" -e CHAIN_DEPLOYMENT_INFO="/config/deployment.json" -e CHILD_CHAIN_INFO="/config/deployed_chain_info.json" rollupcreator create-rollup-testnode
    if $l2timeboost; then
        docker compose run --rm --entrypoint bash rollupcreator -c 'set -eo pipefail; jq ".[] | .\"track-block-metadata-from\"=1 | [.]" /config/deployed_chain_info.json > /tmp/l2_chain_info.json && mv /tmp/l2_chain_info.json /config/l2_chain_info.json'
    else
        docker compose run --rm --entrypoint bash rollupcreator -c "set -eo pipefail; jq [.[]] /config/deployed_chain_info.json > /tmp/l2_chain_info.json && mv /tmp/l2_chain_info.json /config/l2_chain_info.json"
    fi

    if $l2referenceda; then
        docker compose run --rm --entrypoint sh referenceda-provider -c "true" # Noop to mount shared volumes with contracts for manual build and deployment

        echo "== Generating Reference DA keys"
        docker compose run --rm --user root --entrypoint sh datool -c "mkdir /referenceda-provider/keys && chown -R 1000:1000 /referenceda-provider*"
        docker compose run --rm datool keygen --dir /referenceda-provider/keys --ecdsa

        referenceDASignerAddress=$(capture_output docker compose run --rm --entrypoint bash rollupcreator -c "set -eo pipefail; cat /referenceda-provider/keys/ecdsa.pub | sed 's/^04/0x/' | tr -d '\n' | cast keccak | tail -c 41 | cast to-check-sum-address")

        echo "== Deploying Reference DA Proof Validator contract on L1"
        referenceDAOutput=$(docker compose run --rm -e DEPLOYER_PRIVKEY="$l2ownerKey" --entrypoint bash rollupcreator -c "set -eo pipefail; cd /contracts-local && forge create src/osp/ReferenceDAProofValidator.sol:ReferenceDAProofValidator --rpc-url http://geth:8545 --private-key \$DEPLOYER_PRIVKEY --broadcast --constructor-args [$referenceDASignerAddress]") || {
            echo "Error: forge create failed for ReferenceDAProofValidator" >&2
            exit 1
        }
        referenceDAValidatorAddress=$(echo "$referenceDAOutput" | awk '/Deployed to:/ {print $NF}')
        if [ -z "$referenceDAValidatorAddress" ]; then
            echo "Error: failed to extract ReferenceDAProofValidator address from forge output:" >&2
            echo "$referenceDAOutput" >&2
            exit 1
        fi

        echo "== Generating Reference DA Config"
        run_script write-l2-referenceda-config --validator-address "$referenceDAValidatorAddress"
    fi

fi # $force_init

nodeConfigFlags=()

# Remaining init may require AnyTrust committee/mirrors to have been started
if $l2anytrust; then
    if $force_init; then
        echo "== Generating AnyTrust Config"
        docker compose run --rm --user root --entrypoint sh datool -c "mkdir /das-committee-a/keys /das-committee-a/data /das-committee-a/metadata /das-committee-b/keys /das-committee-b/data /das-committee-b/metadata /das-mirror/data /das-mirror/metadata"
        docker compose run --rm --user root --entrypoint sh datool -c "chown -R 1000:1000 /das*"
        docker compose run --rm datool keygen --dir /das-committee-a/keys
        docker compose run --rm datool keygen --dir /das-committee-b/keys
        run_script write-l2-das-committee-config
        run_script write-l2-das-mirror-config

        das_bls_a=$(capture_output docker compose run --rm --entrypoint sh datool -c "cat /das-committee-a/keys/das_bls.pub")
        das_bls_b=$(capture_output docker compose run --rm --entrypoint sh datool -c "cat /das-committee-b/keys/das_bls.pub")

        run_script write-l2-das-keyset-config --dasBlsA "$das_bls_a" --dasBlsB "$das_bls_b"
        docker compose run --rm --entrypoint bash datool -c "set -eo pipefail; /usr/local/bin/datool dumpkeyset --conf.file /config/l2_das_keyset.json | grep 'Keyset: ' | awk '{ printf \"%s\", \$2 }' > /tmp/l2_das_keyset.hex && mv /tmp/l2_das_keyset.hex /config/l2_das_keyset.hex"
        run_script set-valid-keyset

        nodeConfigFlags+=(--anytrust --dasBlsA "$das_bls_a" --dasBlsB "$das_bls_b")
    fi

    if $run; then
        echo "== Starting AnyTrust committee and mirror"
        docker_up_wait das-committee-a das-committee-b das-mirror
    fi
fi

if $l2referenceda && $run; then
    echo "== Starting Reference DA service"
    docker_up_wait referenceda-provider
fi

if $force_init; then
    if $l2timeboost; then
        nodeConfigFlags+=(--timeboost)
    fi
    if $l2referenceda; then
        nodeConfigFlags+=(--referenceDA)
    fi
    if $l2txfiltering; then
        nodeConfigFlags+=(--txfiltering)
    fi

    echo "== Writing configs"
    if $simple; then
        run_script write-config --simple ${nodeConfigFlags[@]+"${nodeConfigFlags[@]}"}
    else
        run_script write-config ${nodeConfigFlags[@]+"${nodeConfigFlags[@]}"}

        echo "== Initializing redis"
        docker_up_wait redis
        run_script redis-init --redundancy "$redundantsequencers"
    fi

    echo "== Funding l2 funnel and dev key"
    docker_up_wait "${INITIAL_SEQ_NODES[@]}"
    # Wait for L1 block production (needed for smart contract wallet deployment and other pending txs)
    wait_for_chain_progress send-l1 "L1"
    run_script bridge-funds --ethamount 100000 --wait
    run_script send-l2 --ethamount 100 --to l2owner --wait
    rollupAddress=$(capture_output docker compose run --rm --entrypoint sh poster -c "jq -r '.[0].rollup.rollup' /config/deployed_chain_info.json")
    require_non_null "$rollupAddress" "rollup address from deployed_chain_info.json"

    if $l2timeboost; then
        run_script send-l2 --ethamount 100 --to auctioneer --wait
        biddingTokenAddress=$(capture_last_field run_script create-erc20 --deployer auctioneer)
        auctionContractAddress=$(capture_last_field run_script deploy-express-lane-auction --bidding-token "$biddingTokenAddress")
        auctioneerAddress=$(capture_output run_script print-address --account auctioneer)
        echo "== Starting up Timeboost auctioneer and bid validator."
        echo "== Bidding token: $biddingTokenAddress, auction contract $auctionContractAddress"
        run_script write-timeboost-configs --auction-contract "$auctionContractAddress"
        docker compose run --rm --user root --entrypoint sh timeboost-auctioneer -c "chown -R 1000:1000 /data"

        echo "== Funding alice and bob user accounts for timeboost testing"
        run_script send-l2 --ethamount 10 --to user_alice --wait
        run_script send-l2 --ethamount 10 --to user_bob --wait
        run_script transfer-erc20 --token "$biddingTokenAddress" --amount 10000 --from auctioneer --to user_alice
        run_script transfer-erc20 --token "$biddingTokenAddress" --amount 10000 --from auctioneer --to user_bob

        docker compose run --rm --entrypoint bash rollupcreator -c "set -eo pipefail; jq --arg ac \"$auctionContractAddress\" --arg aa \"$auctioneerAddress\" '.execution.sequencer.timeboost.enable = true | .execution.sequencer.timeboost.\"auction-contract-address\" = \$ac | .execution.sequencer.timeboost.\"auctioneer-address\" = \$aa' /config/sequencer_config.json > /tmp/sequencer_config.json && mv /tmp/sequencer_config.json /config/sequencer_config.json"
        docker compose restart "${INITIAL_SEQ_NODES[@]}"
        docker_up_wait "${INITIAL_SEQ_NODES[@]}"
    fi

    if $l2txfiltering; then
        echo "== Funding transaction filterer account"
        run_script send-l2 --ethamount 100 --to filterer --wait

        echo "== Granting TransactionFilterer role"
        run_script grant-filterer-role

        echo "== Writing transaction-filterer service config"
        run_script write-tx-filterer-config
    fi

    if $tokenbridge; then
        echo "== Deploying L1-L2 token bridge"
        # Ensure L2 is producing blocks before token bridge deployment
        wait_for_chain_progress send-l2 "L2"
        docker compose run --rm -e ROLLUP_OWNER_KEY="$l2ownerKey" -e ROLLUP_ADDRESS="$rollupAddress" -e PARENT_KEY="$devprivkey" -e PARENT_RPC=http://geth:8545 -e CHILD_KEY="$devprivkey" -e CHILD_RPC=http://sequencer:8547 tokenbridge deploy:local:token-bridge
        docker compose run --rm --entrypoint sh tokenbridge -c "cat network.json && cp network.json l1l2_network.json && cp network.json localNetwork.json"
        echo
    fi

    echo "== Deploy CacheManager on L2"
    docker compose run --rm -e CHILD_CHAIN_RPC="http://sequencer:8547" -e CHAIN_OWNER_PRIVKEY="$l2ownerKey" rollupcreator deploy-cachemanager-testnode

    echo "== Deploy Stylus Deployer on L2"
    run_script create-stylus-deployer --deployer l2owner

    # TODO: remove this once the gas estimation issue is fixed
    echo "== Gas Estimation workaround"
    run_script send-l1 --ethamount 1 --to address_0x0000000000000000000000000000000000000000 --wait
    run_script send-l2 --ethamount 1 --to address_0x0000000000000000000000000000000000000000 --wait

    if $l2_traffic; then
        echo "== Create l2 traffic"
        run_script send-l2 --ethamount 100 --to user_traffic_generator --wait
        run_script send-l2 --ethamount 0.0001 --from user_traffic_generator --to user_traffic_generator --wait --delay 500 --times 1000000 > /dev/null &
        BACKGROUND_PIDS+=($!)
    fi

    if $l3node; then
        echo "== Funding l3 users"
        run_script send-l2 --ethamount 1000 --to validator --wait
        run_script send-l2 --ethamount 1000 --to l3owner --wait
        run_script send-l2 --ethamount 1000 --to l3sequencer --wait

        echo "== Funding l2 deployers"
        run_script send-l1 --ethamount 100 --to user_token_bridge_deployer --wait
        run_script send-l2 --ethamount 100 --to user_token_bridge_deployer --wait

        echo "== Funding token deployer"
        run_script send-l1 --ethamount 100 --to user_fee_token_deployer --wait
        run_script send-l2 --ethamount 100 --to user_fee_token_deployer --wait

        echo "== Writing l3 chain config"
        l3owneraddress=$(capture_output run_script print-address --account l3owner)
        echo "l3owneraddress $l3owneraddress"
        run_script --l2owner "$l3owneraddress" write-l3-chain-config

        EXTRA_L3_DEPLOY_FLAG=()
        if $l3_custom_fee_token; then
            echo "== Deploying custom fee token"
            nativeTokenAddress=$(capture_last_field run_script create-erc20 --deployer user_fee_token_deployer --bridgeable "$tokenbridge" --decimals "$l3_custom_fee_token_decimals")
            run_script transfer-erc20 --token "$nativeTokenAddress" --amount 10000 --from user_fee_token_deployer --to l3owner
            run_script transfer-erc20 --token "$nativeTokenAddress" --amount 10000 --from user_fee_token_deployer --to user_token_bridge_deployer
            EXTRA_L3_DEPLOY_FLAG=(-e "FEE_TOKEN_ADDRESS=$nativeTokenAddress")
            if $l3_custom_fee_token_pricer; then
                echo "== Deploying custom fee token pricer"
                feeTokenPricerAddress=$(capture_last_field run_script create-fee-token-pricer --deployer user_fee_token_deployer)
                EXTRA_L3_DEPLOY_FLAG+=(-e "FEE_TOKEN_PRICER_ADDRESS=$feeTokenPricerAddress")
            fi
        fi

        echo "== Deploying L3"
        l3ownerkey=$(capture_output run_script print-private-key --account l3owner)
        l3sequenceraddress=$(capture_output run_script print-address --account l3sequencer)

        docker compose run --rm -e DEPLOYER_PRIVKEY="$l3ownerkey" -e PARENT_CHAIN_RPC="http://sequencer:8547" -e PARENT_CHAIN_ID=412346 -e CHILD_CHAIN_NAME="orbit-dev-test" -e MAX_DATA_SIZE=104857 -e OWNER_ADDRESS="$l3owneraddress" -e WASM_MODULE_ROOT="$wasmroot" -e SEQUENCER_ADDRESS="$l3sequenceraddress" -e AUTHORIZE_VALIDATORS=10 -e CHILD_CHAIN_CONFIG_PATH="/config/l3_chain_config.json" -e CHAIN_DEPLOYMENT_INFO="/config/l3deployment.json" -e CHILD_CHAIN_INFO="/config/deployed_l3_chain_info.json" ${EXTRA_L3_DEPLOY_FLAG[@]+"${EXTRA_L3_DEPLOY_FLAG[@]}"} rollupcreator create-rollup-testnode
        docker compose run --rm --entrypoint bash rollupcreator -c "set -eo pipefail; jq [.[]] /config/deployed_l3_chain_info.json > /tmp/l3_chain_info.json && mv /tmp/l3_chain_info.json /config/l3_chain_info.json"

        echo "== Funding l3 funnel and dev key"
        docker_up_wait l3node sequencer
        # Wait for L2 block production (needed for L3 smart contract wallet deployment and other pending txs)
        wait_for_chain_progress send-l2 "L2"

        if $l3_token_bridge; then
            echo "== Deploying L2-L3 token bridge"
            deployer_key=$(printf "%s" "user_token_bridge_deployer" | openssl dgst -sha256 | sed 's/^.*= //')
            if ! [[ "$deployer_key" =~ ^[0-9a-f]{64}$ ]]; then
                echo "Error: deployer_key is not a valid 64-char hex string: $deployer_key" >&2
                exit 1
            fi
            rollupAddress=$(capture_output docker compose run --rm --entrypoint sh poster -c "jq -r '.[0].rollup.rollup' /config/deployed_l3_chain_info.json")
            require_non_null "$rollupAddress" "rollup address from deployed_l3_chain_info.json"
            l2Weth=""
            if $tokenbridge; then
                # we deployed an L1 L2 token bridge
                # we need to pull out the L2 WETH address and pass it as an override to the L2 L3 token bridge deployment
                l2Weth_json=$(docker compose run --rm --entrypoint sh tokenbridge -c "cat l1l2_network.json")
                l2Weth=$(echo "$l2Weth_json" | jq -r '.l2Network.tokenBridge.childWeth')
                require_non_null "$l2Weth" "childWeth from l1l2_network.json"
            fi
            docker compose run --rm -e PARENT_WETH_OVERRIDE="$l2Weth" -e ROLLUP_OWNER_KEY="$l3ownerkey" -e ROLLUP_ADDRESS="$rollupAddress" -e PARENT_RPC=http://sequencer:8547 -e PARENT_KEY="$deployer_key" -e CHILD_RPC=http://l3node:3347 -e CHILD_KEY="$deployer_key" tokenbridge deploy:local:token-bridge
            docker compose run --rm --entrypoint sh tokenbridge -c "cat network.json && cp network.json l2l3_network.json"

            # set L3 UpgradeExecutor, deployed by token bridge creator in previous step, to be the L3 chain owner. L3owner (EOA) and alias of L2 UpgradeExecutor have the executor role on the L3 UpgradeExecutor
            echo "== Set L3 UpgradeExecutor to be chain owner"
            tokenBridgeCreator_json=$(docker compose run --rm --entrypoint sh tokenbridge -c "cat l2l3_network.json")
            tokenBridgeCreator=$(echo "$tokenBridgeCreator_json" | jq -r '.l1TokenBridgeCreator')
            require_non_null "$tokenBridgeCreator" "l1TokenBridgeCreator from l2l3_network.json"
            run_script transfer-l3-chain-ownership --creator "$tokenBridgeCreator"
            echo
        fi

        echo "== Fund L3 accounts"
        if $l3_custom_fee_token; then
            run_script bridge-native-token-to-l3 --amount 5000 --from user_fee_token_deployer --wait
            run_script send-l3 --ethamount 100 --from user_fee_token_deployer --wait
        else
            run_script bridge-to-l3 --ethamount 50000 --wait
        fi
        run_script send-l3 --ethamount 10 --to l3owner --wait

        echo "== Deploy CacheManager on L3"
        docker compose run --rm -e CHILD_CHAIN_RPC="http://l3node:3347" -e CHAIN_OWNER_PRIVKEY="$l3ownerkey" rollupcreator deploy-cachemanager-testnode

        echo "== Deploy Stylus Deployer on L3"
        run_script create-stylus-deployer --deployer l3owner --l3

        if $l3_traffic; then
            echo "== Create l3 traffic"
            run_script send-l3 --ethamount 10 --to user_traffic_generator --wait
            run_script send-l3 --ethamount 0.0001 --from user_traffic_generator --to user_traffic_generator --wait --delay 5000 --times 1000000 > /dev/null &
            BACKGROUND_PIDS+=($!)
        fi
    fi
fi

if $run; then
    UP_FLAG=()
    if $detach; then
        if $nowait; then
            UP_FLAG=(--detach)
        else
            UP_FLAG=(--wait)
        fi
    fi

    echo "== Launching Sequencer"
    echo "if things go wrong - use --init to create a new chain"
    echo

    docker compose up ${UP_FLAG[@]+"${UP_FLAG[@]}"} "${NODES[@]}"
fi
