#!/bin/bash
# The script starts up the test node and waits until the timeout (10min) or 
# until send-l2 succeeds.

# Start the test node and get PID, to terminate it once send-l2 is done.
cd ${GITHUB_WORKSPACE}

# TODO once develop is merged into nitro-contract's master, remove the NITRO_CONTRACTS_BRANCH env var
NITRO_CONTRACTS_BRANCH=develop ./test-node.bash --init-force --detach

START=$(date +%s)
SUCCEDED=0

while true; do
    if ${GITHUB_WORKSPACE}/test-node.bash script send-l2 --ethamount 100 --to user_l2user --wait; then
        echo "Sending l2 transaction succeeded"
        SUCCEDED=1
        break
    fi

    # Check if the timeout (10 min) has been reached.
    NOW=$(date +%s)
    DIFF=$((NOW - START))
    if [ "$DIFF" -ge 600 ]; then
        echo "Timed out"
        break
    fi

    sleep 10
done

docker-compose stop

if [ "$SUCCEDED" -eq 0 ]; then
    docker-compose logs
    exit 1
fi

exit 0
