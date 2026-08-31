#!/usr/bin/env bash
# Build and run the Foundly reference-service (pure JDK, no build tool required).
set -e
cd "$(dirname "$0")"
mkdir -p out
javac -d out src/main/java/com/foundly/reference/ReferenceServiceApp.java
echo "Built. Starting on port ${PORT:-8002}..."
java -cp out com.foundly.reference.ReferenceServiceApp
