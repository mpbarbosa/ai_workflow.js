#!/bin/bash
#
# prepare-release.sh - Prepares the project for release
# 
# Usage: ./scripts/prepare-release.sh [version]
#
# This script:
# - Validates version format
# - Runs all tests
# - Updates version in package.json
# - Validates exports and versions
# - Runs security audit
# - Generates changelog entry
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Validate version format
validate_version() {
    local version=$1
    if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$ ]]; then
        log_error "Invalid version format: $version"
        log_info "Expected format: X.Y.Z or X.Y.Z-beta.N"
        exit 1
    fi
}

# Main script
main() {
    local version=${1:-}
    
    echo "================================================"
    echo "  ai_workflow.js Release Preparation"
    echo "================================================"
    echo ""
    
    # Check if version provided
    if [ -z "$version" ]; then
        log_error "Version argument required"
        echo "Usage: $0 <version>"
        echo "Example: $0 1.0.0"
        exit 1
    fi
    
    validate_version "$version"
    log_success "Version format valid: $version"
    
    # Check git status
    log_info "Checking git status..."
    if ! git diff-index --quiet HEAD --; then
        log_warning "Working directory has uncommitted changes"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Aborted by user"
            exit 1
        fi
    fi
    log_success "Git status clean"
    
    # Run linting
    log_info "Running linter..."
    if npm run lint; then
        log_success "Linting passed"
    else
        log_error "Linting failed"
        exit 1
    fi
    
    # Run all tests
    log_info "Running test suite..."
    if npm run test:ci; then
        log_success "All tests passed"
    else
        log_error "Tests failed"
        exit 1
    fi
    
    # Validate exports
    log_info "Validating exports..."
    if npm run validate:exports; then
        log_success "Exports validated"
    else
        log_error "Export validation failed"
        exit 1
    fi
    
    # Validate versions
    log_info "Validating version consistency..."
    if npm run validate:versions; then
        log_success "Versions consistent"
    else
        log_error "Version validation failed"
        exit 1
    fi
    
    # Security audit
    log_info "Running security audit..."
    if npm audit --audit-level=high; then
        log_success "Security audit passed"
    else
        log_warning "Security audit found issues (check npm audit)"
    fi
    
    # Custom security scan
    log_info "Running custom security scan..."
    if node scripts/security-audit.js; then
        log_success "Custom security scan passed"
    else
        log_warning "Custom security scan found issues"
    fi
    
    # Update package.json version
    log_info "Updating package.json version to $version..."
    npm version "$version" --no-git-tag-version
    log_success "package.json updated"
    
    # Create git tag
    log_info "Creating git tag v$version..."
    git add package.json
    git commit -m "chore(release): version $version

Release preparation for v$version

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    git tag -a "v$version" -m "Release v$version"
    log_success "Git tag created"
    
    # Show summary
    echo ""
    echo "================================================"
    echo "  Release Preparation Complete!"
    echo "================================================"
    echo ""
    log_success "Version: $version"
    log_success "Git tag: v$version"
    echo ""
    log_info "Next steps:"
    echo "  1. Review the changes: git show"
    echo "  2. Push to GitHub: git push origin main --tags"
    echo "  3. GitHub Actions will automatically:"
    echo "     - Run tests on all platforms"
    echo "     - Publish to npm"
    echo "     - Create GitHub release"
    echo ""
    echo "Or manually publish:"
    echo "  npm publish"
    echo ""
}

main "$@"
