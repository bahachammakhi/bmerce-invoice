#!/bin/bash

# Invoice Processing - Easy Start Script
# This script sets up and runs the project with all dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Invoice Processing - Project Setup   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker is running${NC}"
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Warning: .env file not found.${NC}"
        if [ -f .env.example ]; then
            echo -e "${YELLOW}Copying .env.example to .env...${NC}"
            cp .env.example .env
            echo -e "${GREEN}✓ Created .env from .env.example${NC}"
            echo -e "${YELLOW}  Please review and update .env with your settings${NC}"
        else
            echo -e "${RED}Error: No .env or .env.example found.${NC}"
            echo -e "${YELLOW}Please create a .env file with required variables.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ .env file exists${NC}"
    fi
}

# Install dependencies
install_deps() {
    echo ""
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Start Docker containers
start_docker() {
    echo ""
    echo -e "${BLUE}Starting Docker containers (PostgreSQL & Adminer)...${NC}"
    npm run docker:up
    echo -e "${GREEN}✓ Docker containers started${NC}"
    echo -e "  - PostgreSQL: localhost:5432"
    echo -e "  - Adminer: http://localhost:8080"

    # Wait for PostgreSQL to be ready
    echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
    sleep 3

    # Check if PostgreSQL is accepting connections
    for i in {1..30}; do
        if docker exec $(docker ps -q -f name=postgres) pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}Error: PostgreSQL did not start in time${NC}"
            exit 1
        fi
        sleep 1
    done
}

# Setup database
setup_db() {
    echo ""
    echo -e "${BLUE}Setting up database...${NC}"

    echo -e "  Pushing schema to database..."
    npm run db:push
    echo -e "${GREEN}✓ Database schema synced${NC}"
}

# Seed database (optional)
seed_db() {
    echo ""
    read -p "Do you want to seed the database with initial data? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Seeding database...${NC}"
        npm run db:seed
        echo -e "${GREEN}✓ Database seeded${NC}"
    else
        echo -e "${YELLOW}Skipping database seeding${NC}"
    fi
}

# Start development server
start_dev() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Setup complete! Starting server...   ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "Application will be available at: ${BLUE}http://localhost:3000${NC}"
    echo ""
    npm run dev
}

# Main execution
main() {
    cd "$(dirname "$0")/.." # Navigate to project root

    check_docker
    check_env
    install_deps
    start_docker
    setup_db
    seed_db
    start_dev
}

# Parse arguments
case "${1:-}" in
    --skip-docker)
        echo -e "${YELLOW}Skipping Docker setup...${NC}"
        cd "$(dirname "$0")/.."
        check_env
        install_deps
        setup_db
        start_dev
        ;;
    --dev-only)
        echo -e "${YELLOW}Starting dev server only...${NC}"
        cd "$(dirname "$0")/.."
        npm run dev
        ;;
    --help|-h)
        echo "Usage: ./scripts/start.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --skip-docker  Skip Docker container setup"
        echo "  --dev-only     Only start the development server"
        echo "  --help, -h     Show this help message"
        echo ""
        echo "Default: Full setup including Docker, database, and dev server"
        ;;
    *)
        main
        ;;
esac
