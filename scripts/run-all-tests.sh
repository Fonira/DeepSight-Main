#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== DeepSight Test Suite ==="

echo ""
echo "[1/4] Backend tests..."
cd backend && python -m pytest tests/ -x --timeout=30 -q && cd "$ROOT_DIR"

echo ""
echo "[2/4] Frontend tests..."
cd frontend && npm run test && cd "$ROOT_DIR"

echo ""
echo "[3/4] Mobile tests..."
cd mobile && npm test -- --ci && cd "$ROOT_DIR"

echo ""
echo "[4/4] Extension tests..."
cd extension && npm test -- --ci --passWithNoTests && cd "$ROOT_DIR"

echo ""
echo "All tests passed!"
