.PHONY: test test-backend test-frontend test-mobile test-extension test-e2e test-all

test: test-all

test-backend:
	cd backend && python -m pytest tests/ -x --timeout=30 -q

test-frontend:
	cd frontend && npm run test

test-mobile:
	cd mobile && npm test -- --ci

test-extension:
	cd extension && npm test -- --ci --passWithNoTests

test-e2e:
	@echo "E2E tests not yet configured — TODO: add Playwright/Cypress"

test-all: test-backend test-frontend test-mobile test-extension
	@echo ""
	@echo "All tests passed!"
