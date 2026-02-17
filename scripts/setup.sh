#!/usr/bin/env bash
#
# setup.sh - Development Environment Setup
# 
# This script sets up the development environment for ai_workflow.js
# Installs dependencies, initializes submodules, and creates required directories.
#
# Usage: ./scripts/setup.sh

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print colored messages
info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

echo "========================================="
echo "  ai_workflow.js - Development Setup"
echo "========================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="18.0.0"

# Simple version comparison (works for most cases)
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    error "Node.js version $NODE_VERSION is too old. Please upgrade to >= 18.0.0"
    exit 1
fi

info "Node.js version: $NODE_VERSION ✓"

# Check npm version
echo "Checking npm version..."
if ! command -v npm &> /dev/null; then
    error "npm is not installed"
    exit 1
fi

NPM_VERSION=$(npm --version)
info "npm version: $NPM_VERSION ✓"

# Install dependencies
echo ""
echo "Installing npm dependencies..."
npm install

if [ $? -eq 0 ]; then
    info "Dependencies installed successfully"
else
    error "Failed to install dependencies"
    exit 1
fi

# Initialize git submodules
echo ""
echo "Initializing git submodules..."
if [ -d ".git" ]; then
    git submodule update --init --recursive
    if [ $? -eq 0 ]; then
        info "Submodules initialized"
    else
        warn "Failed to initialize submodules (this is OK if not a git repository)"
    fi
else
    warn "Not a git repository - skipping submodule initialization"
fi

# Create required directories
echo ""
echo "Creating required directories..."
DIRECTORIES=(
    ".ai_workflow"
    ".ai_workflow/backlog"
    ".ai_workflow/summaries"
    ".ai_workflow/logs"
    ".ai_workflow/metrics"
    ".ai_workflow/checkpoints"
    ".ai_workflow/prompts"
    ".ai_workflow/ml_models"
    ".ai_workflow/.incremental_cache"
)

for dir in "${DIRECTORIES[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        info "Created: $dir"
    else
        info "Exists: $dir"
    fi
done

# Create .gitignore entries if not present
echo ""
echo "Checking .gitignore..."
if [ -f ".gitignore" ]; then
    if ! grep -q "^\.ai_workflow/" .gitignore; then
        echo "" >> .gitignore
        echo "# AI Workflow artifacts" >> .gitignore
        echo ".ai_workflow/" >> .gitignore
        info "Added .ai_workflow/ to .gitignore"
    else
        info ".gitignore already configured"
    fi
else
    warn ".gitignore not found - skipping"
fi

# Run initial validation
echo ""
echo "Running initial validation..."
npm run lint --silent
if [ $? -eq 0 ]; then
    info "Linting passed"
else
    warn "Linting found issues (run 'npm run lint' to see details)"
fi

# Run tests
echo ""
echo "Running tests..."
npm test --silent -- --passWithNoTests
if [ $? -eq 0 ]; then
    info "Tests passed"
else
    error "Tests failed (run 'npm test' to see details)"
    exit 1
fi

# Summary
echo ""
echo "========================================="
echo "  Setup Complete! 🎉"
echo "========================================="
echo ""
info "Development environment ready"
info "Next steps:"
echo "  - Run 'npm test' to run tests"
echo "  - Run 'npm run lint' to check code style"
echo "  - Run 'npm run format' to format code"
echo "  - See CONTRIBUTING.md for development guidelines"
echo ""
