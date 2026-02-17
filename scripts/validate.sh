#!/usr/bin/env bash
#
# validate.sh - Full Validation Pipeline
#
# Runs complete validation: linting, tests, formatting checks, and version consistency
#
# Usage: ./scripts/validate.sh [--fix] [--skip-tests]

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
FIX=false
SKIP_TESTS=false

for arg in "$@"; do
    case $arg in
        --fix)
            FIX=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--fix] [--skip-tests]"
            echo ""
            echo "Options:"
            echo "  --fix         Auto-fix linting and formatting issues"
            echo "  --skip-tests  Skip running tests (faster validation)"
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
echo "  ai_workflow.js - Full Validation"
echo "==========================================="
echo ""

# Track overall status
VALIDATION_PASSED=true

# 1. Linting
section "1. Running ESLint..."
if [ "$FIX" = true ]; then
    npm run lint -- --fix
    LINT_EXIT=$?
else
    npm run lint
    LINT_EXIT=$?
fi

if [ $LINT_EXIT -eq 0 ]; then
    info "Linting passed"
else
    error "Linting failed"
    VALIDATION_PASSED=false
fi
echo ""

# 2. Formatting
section "2. Checking code formatting (Prettier)..."
if [ "$FIX" = true ]; then
    npm run format
    info "Code formatted"
else
    # Check if formatting is needed
    if npm run format:check --silent 2>&1 | grep -q "All matched files"; then
        info "Formatting check passed"
    else
        warn "Formatting check failed (run with --fix to auto-format)"
        VALIDATION_PASSED=false
    fi
fi
echo ""

# 3. Version Consistency
section "3. Checking version consistency..."
if [ -f "scripts/check-version-consistency.js" ]; then
    node scripts/check-version-consistency.js
    VERSION_EXIT=$?
    
    if [ $VERSION_EXIT -eq 0 ]; then
        info "Version consistency validated"
    else
        error "Version inconsistencies found"
        VALIDATION_PASSED=false
    fi
else
    warn "Version consistency checker not found - skipping"
fi
echo ""

# 4. Export Validation
section "4. Validating module exports..."
if [ -f "scripts/validate-exports.js" ]; then
    node scripts/validate-exports.js
    EXPORT_EXIT=$?
    
    if [ $EXPORT_EXIT -eq 0 ]; then
        info "All exports validated"
    else
        error "Export validation failed"
        VALIDATION_PASSED=false
    fi
else
    warn "Export validator not found - skipping"
fi
echo ""

# 5. Tests
if [ "$SKIP_TESTS" = false ]; then
    section "5. Running test suite..."
    npm test --silent -- --passWithNoTests
    TEST_EXIT=$?
    
    if [ $TEST_EXIT -eq 0 ]; then
        info "All tests passed"
        
        # Show test summary
        TEST_SUMMARY=$(npm test --silent 2>&1 | tail -3 | head -1)
        echo "   $TEST_SUMMARY"
    else
        error "Tests failed"
        VALIDATION_PASSED=false
    fi
    echo ""
else
    section "5. Tests"
    warn "Tests skipped (--skip-tests flag)"
    echo ""
fi

# 6. Coverage Check (if tests ran)
if [ "$SKIP_TESTS" = false ]; then
    section "6. Checking test coverage..."
    
    # Run tests with coverage silently
    npm test -- --coverage --silent > /dev/null 2>&1 || true
    
    if [ -f "coverage/coverage-summary.json" ]; then
        COVERAGE_DATA=$(cat coverage/coverage-summary.json | node -e "
            const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
            const total = data.total;
            console.log(JSON.stringify({
                statements: total.statements.pct,
                branches: total.branches.pct,
                functions: total.functions.pct,
                lines: total.lines.pct
            }));
        ")
        
        COVERAGE_PCT=$(echo $COVERAGE_DATA | node -e "
            const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
            console.log(data.statements);
        ")
        
        # Check if coverage meets threshold (90%)
        THRESHOLD=90
        MEETS_THRESHOLD=$(echo "$COVERAGE_PCT >= $THRESHOLD" | bc -l)
        
        if [ "$MEETS_THRESHOLD" -eq 1 ]; then
            info "Coverage: ${COVERAGE_PCT}% (exceeds ${THRESHOLD}% threshold)"
        else
            warn "Coverage: ${COVERAGE_PCT}% (below ${THRESHOLD}% threshold)"
            VALIDATION_PASSED=false
        fi
    else
        warn "Coverage report not found"
    fi
    echo ""
fi

# 7. Documentation
section "7. Checking documentation..."
if [ -f "scripts/validate-docs.js" ]; then
    node scripts/validate-docs.js
    DOCS_EXIT=$?
    
    if [ $DOCS_EXIT -eq 0 ]; then
        info "Documentation validated"
    else
        warn "Documentation validation found issues"
    fi
else
    # Simple documentation check
    DOC_COUNT=$(find docs -name "*.md" 2>/dev/null | wc -l)
    if [ "$DOC_COUNT" -gt 0 ]; then
        info "Found $DOC_COUNT documentation files"
    else
        warn "No documentation files found"
    fi
fi
echo ""

# Final Summary
echo "==========================================="
if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}  ✓ ALL VALIDATIONS PASSED${NC}"
    echo "==========================================="
    echo ""
    info "Project is ready for commit/release"
    echo ""
    exit 0
else
    echo -e "${RED}  ✗ VALIDATION FAILED${NC}"
    echo "==========================================="
    echo ""
    error "Please fix the issues above before committing"
    echo ""
    if [ "$FIX" = false ]; then
        echo "Tip: Run with --fix to auto-fix some issues"
    fi
    echo ""
    exit 1
fi
