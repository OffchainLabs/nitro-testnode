#!/usr/bin/env bash

VOLUME_ARCHIVE="volumes.tar.gz"
DB_DUMP="database_dump.sql"
REDIS_DUMP="redis_dump.rdb"
CACHE_MANIFEST="cache_manifest.txt"
echo "Creating cache..."

# Define the cache directory
CACHE_DIR="./cache"
mkdir -p $CACHE_DIR

# Archive Docker volumes
echo "Archiving Docker volumes..."
docker run --rm \
  -v nitro-testnode_l1data:/l1data \
  -v nitro-testnode_consensus:/consensus \
  -v nitro-testnode_l1keystore:/l1keystore \
  -v nitro-testnode_seqdata:/seqdata \
  -v nitro-testnode_seqdata_b:/seqdata_b \
  -v nitro-testnode_seqdata_c:/seqdata_c \
  -v nitro-testnode_seqdata_d:/seqdata_d \
  -v nitro-testnode_unsafestaker-data:/unsafestaker-data \
  -v nitro-testnode_validator-data:/validator-data \
  -v nitro-testnode_poster-data:/poster-data \
  -v nitro-testnode_poster-data-b:/poster-data-b \
  -v nitro-testnode_poster-data-c:/poster-data-c \
  -v nitro-testnode_config:/config \
  -v nitro-testnode_postgres-data:/postgres-data \
  -v nitro-testnode_tokenbridge-data:/tokenbridge-data \
  -v $(pwd)/${CACHE_DIR}:/backup \
  alpine:3.14 \
  tar czf /backup/volumes.tar.gz \
  --exclude='l1data/geth.ipc' \
  -C / l1data consensus l1keystore seqdata seqdata_b seqdata_c seqdata_d \
  unsafestaker-data validator-data poster-data poster-data-b poster-data-c \
  config postgres-data tokenbridge-data

# Save Redis data
echo "Saving Redis data..."
if docker-compose ps | grep -q "redis.*Up"; then
  docker-compose exec -T redis redis-cli SAVE
  docker cp nitro-testnode-redis-1:/data/dump.rdb ${CACHE_DIR}/redis_dump.rdb
else
  echo "Redis container is not running. Skipping Redis dump."
fi

# Save Postgres data
echo "Saving Postgres data..."
if docker-compose ps | grep -q "postgres.*Up"; then
  docker-compose exec -T postgres pg_dumpall -c -U postgres >${CACHE_DIR}/${DB_DUMP}
else
  echo "Postgres container is not running. Skipping Postgres dump."
fi

# Save container states
echo "Saving container states..."
docker-compose ps >${CACHE_DIR}/container_states.txt

# Create cache manifest
echo "Creating cache manifest..."
echo "Cache created on: $(date)" >${CACHE_DIR}/${CACHE_MANIFEST}
echo "Docker Compose Config:" >>${CACHE_DIR}/${CACHE_MANIFEST}
docker-compose config >>${CACHE_DIR}/${CACHE_MANIFEST}

echo "Cache created successfully in ${CACHE_DIR}."
