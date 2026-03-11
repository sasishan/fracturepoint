#!/bin/bash
# Requires: protoc + protoc-gen-ts
# Install: npm install -g ts-proto
set -e
mkdir -p generated
protoc \
  --plugin=protoc-gen-ts=$(which protoc-gen-ts) \
  --ts_out=generated \
  --ts_opt=esModuleInterop=true \
  -I src \
  src/*.proto
echo "Proto compilation complete → generated/"
