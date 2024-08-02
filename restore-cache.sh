#!/usr/bin/env bash

CACHE_DIR="./cache"
VOLUME_ARCHIVE="volumes.tar.gz"
DB_DUMP="database_dump.sql"
REDIS_DUMP="redis_dump.rdb"

if [ ! -d "$CACHE_DIR" ] || [ ! -f "$CACHE_DIR/$VOLUME_ARCHIVE" ]; then
  echo "Cache not found. Cannot restore."
  exit 1
fi

# Stop all containers
docker-compose down

# Restore Docker volumes
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
  -v $(pwd)/$CACHE_DIR:/backup \
  alpine:3.14 \
  tar xzf /backup/$VOLUME_ARCHIVE -C /

# # Start containers
# docker-compose up -d

# # Restore Postgres data
# if [ -f "${CACHE_DIR}/${DB_DUMP}" ]; then
#   docker-compose exec -T postgres psql -U postgres <${CACHE_DIR}/${DB_DUMP}
# fi

# # Restore Redis data
# if [ -f "${CACHE_DIR}/${REDIS_DUMP}" ]; then
#   docker cp ${CACHE_DIR}/${REDIS_DUMP} nitro-testnode-redis-1:/data/dump.rdb
#   docker-compose restart redis
# fi

echo "Cache restored successfully."
