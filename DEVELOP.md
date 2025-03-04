# Running validator and validation node

Pull `https://github.com/wurdum/nitro-testnode/tree/without-sequencer` fork of `https://github.com/OffchainLabs/nitro-testnode`.

```sh
# Start containers
./test-node.bash --init-force --blockscout --detach --validate

# Stop validator and validator node containers
docker compose stop validator validation_node

# Build replay wasm module (if not done yet)
make build-replay-env

# Fetch module root
cat ./target/machines/latest/module-root.txt
```

You'll need to update nitro source code to override directory where `jit` exec is located.
Update `getJitPath()` function to be smth like

```go
func getJitPath() (string, error) {
	// Check for environment variable first
	if envPath := os.Getenv("NITRO_PRJIT_PATH"); envPath != "" {
		return envPath, nil
	}

	// Default code flow if environment variable is not setvar jitBinary string
	var jitBinary string
	executable, err := os.Executable()
  ...
}
```

Run validation node with the following parameters
```sh
NITRO_PRJIT_PATH={path_to_nitro}/nitro/arbitrator/target/release/jit

--conf.file={path_to_nitro_scripts}/nitro-testnode/data/config/validation_node_config_local.json
--validation.use-jit=true # Specify false to use Arbitrator machine instead of JIT (WASM)
```

Run validator with the following parameters
```sh
--persistent.global-config
{path_to_nitro_scripts}/nitro-testnode/data/valdata_local
--conf.file
{path_to_nitro_scripts}/nitro-testnode/data/config/validator_config_local.json
--http.port
8547
--http.api
net,web3,arb,debug
--ws.port
8548
--node.block-validator.current-module-root
0x044b56e3822591dbed23493585c1eb3f5f36b3e5c98ba9c9409bd310fc822240 # Use module root from your ./target/machines/latest/module-root.txt file
```
