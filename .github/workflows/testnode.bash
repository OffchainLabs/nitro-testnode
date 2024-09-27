#!/bin/bash
# The script starts up the test node and waits until the timeout (10min) or
# until send-l2 succeeds.

# Start the test node and get PID, to terminate it once send-l2 is done.
cd ${GITHUB_WORKSPACE}

./test-node.bash "$@"

if [ $? -ne 0 ]; then
    echo "test-node.bash failed"
    docker compose logs --tail=1000
    exit 1
fi


START=$(date +%s)
L2_TRANSACTION_SUCCEEDED=false
# if we're not running an l3node then we just set l3 to success by default
L3_TRANSACTION_SUCCEEDED=true
for arg in "$@"; do
    if [ "$arg" = "--l3node" ]; then
        L3_TRANSACTION_SUCCEEDED=false
    fi
done
SUCCEEDED=false

while true; do
    if [ "$L2_TRANSACTION_SUCCEEDED" = false ]; then
        if ${GITHUB_WORKSPACE}/test-node.bash script send-l2 --ethamount 2 --to user_l2user --wait; then
            echo "Sending l2 transaction succeeded"
            L2_TRANSACTION_SUCCEEDED=true
        fi
    fi

    if [ "$L3_TRANSACTION_SUCCEEDED" = false ]; then
        if ${GITHUB_WORKSPACE}/test-node.bash script send-l3 --ethamount 2 --to user_l3user --wait; then
            echo "Sending l3 transaction succeeded"
            L3_TRANSACTION_SUCCEEDED=true
        fi
    fi

    if [ "$L2_TRANSACTION_SUCCEEDED" = true ] && [ "$L3_TRANSACTION_SUCCEEDED" = true ]; then
        SUCCEEDED=true
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

docker compose stop

if [ "$SUCCEEDED" = false ]; then
    docker compose logs
    exit 1
fi

exit 0
