#!/usr/bin/env bash
# The script starts up the test node (with timeout 1 minute), with option to
# run l2 transactions to make sure node is working

timeout 60 ${{ github.workspace }}/nitro-testnode/test-node.bash --init --dev || exit_status=$?

if  [ -n "$exit_status" ] && [ $exit_status -ne 0 ] && [ $exit_status -ne 124 ]; then
    echo "Testnode failed."
    exit $exit_status
fi

echo "Testnode succeeded."
