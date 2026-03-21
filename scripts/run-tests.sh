#!/bin/bash
# ╔════════════════════════════════════════════════════════════════════════════════════╗
# ║  🧪 DeepSight — Script de Tests Complet                                            ║
# ║  Usage: ./scripts/run-tests.sh [frontend|backend|e2e|all] [--coverage] [--watch]    ║
# ╚════════════════════════════════════════════════════════════════════════════════════╝

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Args
TARGET="${1:-all}"
COVERAGE=false
WATCH=false

for arg in "$@"; do
  case $arg in
    --coverage) COVERAGE=true ;;
    --watch) WATCH=true ;;
  esac
done

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🧪 DeepSight Test Runner                    ║${NC}"
echo -e "${CYAN}║  Target: ${YELLOW}$TARGET${CYAN}                             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# 🖥️ FRONTEND TESTS (Vitest)
# ═══════════════════════════════════════════════════════════════

run_frontend_tests() {
  echo -e "${BLUE}━━━ 🖥️ Frontend Tests (Vitest) ━━━${NC}"
  cd "$FRONTEND_DIR"

  if [ "$WATCH" = true ]; then
    npx vitest --watch
    return
  fi

  if [ "$COVERAGE" = true ]; then
    npx vitest run --coverage
  else
    npx vitest run
  fi

  echo -e "${GREEN}✅ Frontend tests terminés${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════
# 🐍 BACKEND TESTS (Pytest)
# ═══════════════════════════════════════════════════════════════

run_backend_tests() {
  echo -e "${BLUE}━━━ 🐍 Backend Tests (Pytest) ━━━${NC}"
  cd "$BACKEND_DIR"

  if [ "$COVERAGE" = true ]; then
    python -m pytest tests/ -v --cov=src --cov-report=html --cov-report=term-missing -x
  else
    python -m pytest tests/ -v -x
  fi

  echo -e "${GREEN}✅ Backend tests terminés${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════
# 🌐 E2E TESTS (Playwright)
# ═══════════════════════════════════════════════════════════════

run_e2e_tests() {
  echo -e "${BLUE}━━━ 🌐 E2E Tests (Playwright) ━━━${NC}"
  cd "$FRONTEND_DIR"

  npx playwright test

  echo -e "${GREEN}✅ E2E tests terminés${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════
# 🚀 EXÉCUTION
# ═══════════════════════════════════════════════════════════════

FAILED=0

case "$TARGET" in
  frontend)
    run_frontend_tests || FAILED=1
    ;;
  backend)
    run_backend_tests || FAILED=1
    ;;
  e2e)
    run_e2e_tests || FAILED=1
    ;;
  all)
    echo -e "${YELLOW}▶ Phase 1/3 — Frontend Unit + Integration${NC}"
    run_frontend_tests || FAILED=1

    echo -e "${YELLOW}▶ Phase 2/3 — Backend Unit + Integration${NC}"
    run_backend_tests || FAILED=1

    echo -e "${YELLOW}▶ Phase 3/3 — E2E Playwright${NC}"
    run_e2e_tests || FAILED=1
    ;;
  *)
    echo -e "${RED}❌ Target inconnue: $TARGET${NC}"
    echo "Usage: ./scripts/run-tests.sh [frontend|backend|e2e|all] [--coverage] [--watch]"
    exit 1
    ;;
esac

# ═══════════════════════════════════════════════════════════════
# 📊 RÉSULTAT
# ═══════════════════════════════════════════════════════════════

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ TOUS LES TESTS PASSENT                   ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
else
  echo -e "${RED}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ❌ DES TESTS ONT ÉCHOUÉ                     ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════╝${NC}"
  exit 1
fi
