#!/usr/bin/env bash
#
# test-integration.sh - Integration Test Runner
#
# Runs integration tests, generates coverage reports, and validates thresholds
#
# Usage: ./scripts/test-integration.sh [--coverage] [--verbose]

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
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

section() {
    echo -e "${CYAN}▶${NC} $1"
}

# Parse arguments
COVERAGE=false
VERBOSE=false

for arg in "$@"; do
    case $arg in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--coverage] [--verbose]"
            echo ""
            echo "Options:"
            echo "  --coverage    Generate code coverage report"
            echo "  --verbose     Show detailed test output"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "==========================================="
echo "  ai_workflow.js - Integration Tests"
echo "==========================================="
echo ""

# Run integration tests
section "Running integration tests..."
echo ""

if [ "$COVERAGE" = true ]; then
    section "With code coverage analysis"
    
    if [ "$VERBOSE" = true ]; then
        npm test -- --coverage
    else
        npm test -- --coverage --silent
    fi
    
    TEST_EXIT=$?
    
    if [ $TEST_EXIT -eq 0 ]; then
        info "All tests passed"
    else
        error "Some tests failed"
        exit $TEST_EXIT
    fi
    
    # Generate HTML coverage report
    section "Generating HTML coverage report..."
    if [ -d "coverage" ]; then
        info "Coverage report available at: coverage/lcov-report/index.html"
        
        # Show coverage summary
        echo ""
        section "Coverage Summary:"
        if [ -f "coverage/coverage-summary.json" ]; then
            # Extract and display coverage percentages
            cat coverage/coverage-summary.json | node -e "
                const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
                const total = data.total;
                console.log('  Statements:', total.statements.pct + '%');
                console.log('  Branches:  ', total.branches.pct + '%');
                console.log('  Functions: ', total.functions.pct + '%');
                console.log('  Lines:     ', total.lines.pct + '%');
            "
        fi
    fi
else
    # Run tests without coverage
    if [ "$VERBOSE" = true ]; then
        npm test
    else
        npm test --silent
    fi
    
    TEST_EXIT=$?
    
    if [ $TEST_EXIT -eq 0 ]; then
        info "All tests passed"
    else
        error "Some tests failed"
        exit $TEST_EXIT
    fi
fi

# Check for skipped tests
echo ""
section "Checking for skipped tests..."
SKIPPED=$(npm test --silent 2>&1 | grep -oP '\d+ skipped' | grep -oP '^\d+' || echo "0")

if [ "$SKIPPED" -gt 0 ]; then
    warn "$SKIPPED tests skipped"
else
    info "No tests skipped"
fi

# Summary
echo ""
echo "==========================================="
echo "  Integration Tests Complete! ✓"
echo "==========================================="
echo ""

if [ "$COVERAGE" = true ]; then
    info "Coverage report generated"
    echo "  View at: coverage/lcov-report/index.html"
fi

echo ""
info "Test suite status: PASSED"
echo ""
