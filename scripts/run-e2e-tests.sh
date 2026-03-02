#!/bin/bash

# E2E Test Runner Script
# This script ensures all prerequisites are met before running Playwright tests

set -e

echo "🚀 E2E Test Runner Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 0: Determine database port and connection string
DEFAULT_DB_PORT=${DB_PORT:-5432}
MAX_DB_PORT_SEARCH=${MAX_DB_PORT_SEARCH:-5}

is_port_in_use() {
    lsof -iTCP:"$1" -sTCP:LISTEN > /dev/null 2>&1
}

find_available_port() {
    local start_port=$1
    local attempts=$2
    local offset=0
    while [ $offset -lt $attempts ]; do
        local candidate=$((start_port + offset))
        if ! is_port_in_use "$candidate"; then
            echo "$candidate"
            return 0
        fi
        offset=$((offset + 1))
    done
    return 1
}

if ! DB_PORT=$(find_available_port "$DEFAULT_DB_PORT" "$MAX_DB_PORT_SEARCH"); then
    echo -e "${RED}Unable to find a free PostgreSQL port starting at $DEFAULT_DB_PORT (searched $MAX_DB_PORT_SEARCH ports). Stop the conflicting service or set DB_PORT manually.${NC}"
    exit 1
fi

if [ "$DB_PORT" != "$DEFAULT_DB_PORT" ]; then
    echo -e "${YELLOW}Port $DEFAULT_DB_PORT is busy. Switching to available port $DB_PORT for PostgreSQL.${NC}"
fi

export POSTGRES_PORT=$DB_PORT
export DATABASE_URL="postgresql://postgres:password@localhost:${DB_PORT}/invoice_db"
echo ""
echo "🔌 Using PostgreSQL port: ${DB_PORT}"
echo "🗄  DATABASE_URL=${DATABASE_URL}"

ensure_modern_node() {
    local required_major=18
    local current_major
    current_major=$(node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo 0)

    if [ "$current_major" -ge "$required_major" ]; then
        return
    fi

    local nvm_node_dir="$HOME/.nvm/versions/node"
    if [ -d "$nvm_node_dir" ]; then
        local target_version
        target_version=$(ls -1 "$nvm_node_dir" | sort -r | head -n 1)
        if [ -n "$target_version" ] && [ -x "$nvm_node_dir/$target_version/bin/node" ]; then
            export PATH="$nvm_node_dir/$target_version/bin:$PATH"
            echo -e "${YELLOW}⚠️  System node is v${current_major}. Using Node ${target_version} from nvm for tests.${NC}"
            current_major=$("$nvm_node_dir/$target_version/bin/node" -p "parseInt(process.versions.node.split('.')[0], 10)")
        fi
    fi

    if [ "$current_major" -lt "$required_major" ]; then
        echo -e "${RED}Node >= ${required_major} is required to run Next.js dev server. Install a newer Node or configure nvm.${NC}"
        exit 1
    fi
}

ensure_modern_node

# Step 1: Check if Docker is running
echo ""
echo "📦 Step 1: Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi
echo -e "${GREEN}✔ Docker is running${NC}"

# Step 2: Start database containers
echo ""
echo "🐘 Step 2: Starting database containers..."
npm run docker:up
sleep 3

# Step 3: Wait for PostgreSQL to be ready
echo ""
echo "⏳ Step 3: Waiting for PostgreSQL to be ready..."
DB_CONTAINER_NAME=${DB_CONTAINER_NAME:-invoice_postgres}
max_attempts=30
attempt=0

# Verify the container exists before waiting on it
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER_NAME}\$"; then
    echo -e "${YELLOW}Database container ${DB_CONTAINER_NAME} not found. Listing running containers for reference:${NC}"
    docker ps --format ' - {{.Names}} ({{.Status}})'
    echo -e "${RED}Unable to locate PostgreSQL container. Ensure docker-compose is using the expected container name or set DB_CONTAINER_NAME.${NC}"
    exit 1
fi

while ! docker exec "${DB_CONTAINER_NAME}" pg_isready -U postgres > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo -e "${RED}PostgreSQL did not become ready in time${NC}"
        exit 1
    fi
    echo "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
    sleep 1
done
echo -e "${GREEN}✔ PostgreSQL is ready${NC}"

# Step 4: Push database schema
echo ""
echo "📊 Step 4: Pushing database schema..."
PRISMA_NODE="node"
PRISMA_NODE_MAJOR=$($PRISMA_NODE -p "parseInt(process.versions.node.split('.')[0], 10)")
PRISMA_FLAGS=()
if [ "$PRISMA_NODE_MAJOR" -lt 20 ]; then
  PRISMA_FLAGS+=(--experimental-wasm-reftypes)
fi
"$PRISMA_NODE" "${PRISMA_FLAGS[@]}" ./node_modules/prisma/build/index.js db push

# Step 5: Seed the database
echo ""
echo "🌱 Step 5: Seeding database with test data..."
npm run db:seed

# Step 6: Check if Playwright browsers are installed
echo ""
echo "🌐 Step 6: Ensuring Playwright browsers..."
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=${PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:-120000} npx playwright install chromium > /dev/null
echo -e "${GREEN}✔ Playwright is ready${NC}"

# Step 7: Run tests
echo ""
echo "🧪 Step 7: Running E2E tests..."
echo "========================================"

# Run tests with specified options
# Uses --project to run on single browser for faster feedback
# Playwright config will start the dev server automatically

if [ "$1" == "--all" ]; then
    echo "Running on all browsers..."
    npx playwright test --reporter=list
elif [ "$1" == "--headed" ]; then
    echo "Running in headed mode (browser visible)..."
    npx playwright test --project=chromium --headed --reporter=list
elif [ "$1" == "--ui" ]; then
    echo "Opening Playwright UI..."
    npx playwright test --ui
else
    echo "Running on Chromium only (use --all for all browsers)..."
    npx playwright test --project=chromium --reporter=list
fi

echo ""
echo "========================================"
echo -e "${GREEN}✔ Tests completed!${NC}"
