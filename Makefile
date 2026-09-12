# Node runs in a container (docker-compose.yml); the host needs Docker only.
RUN := docker compose run --rm --no-deps app

.DEFAULT_GOAL := help

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

dev: ## Dev server on http://localhost:3000 (APP_PORT=3001 make dev for another port)
	docker compose up

install: ## npm ci
	$(RUN) npm ci

test: ## Vitest, single run
	$(RUN) npm test

typecheck: ## next typegen + tsc
	$(RUN) npm run typecheck

lint: ## ESLint
	$(RUN) npm run lint

check: lint typecheck test ## lint + typecheck + test

build: ## next build
	$(RUN) npm run build

npm: ## Any npm command: make npm args="install zod"
	$(RUN) npm $(args)

sh: ## Shell in the node container
	$(RUN) bash

dev-user: ## Create the local test user (dev@sledger.local / sledger-dev-1234); needs `supabase start`
	@./scripts/dev-user.sh

test-db: ## Vitest including the RLS test against the running local Supabase
	@STATUS="$$(supabase status -o json 2>/dev/null)" || { echo "Supabase is not running. Run: supabase start" >&2; exit 1; }; \
	ANON="$$(printf '%s' "$$STATUS" | python3 -c 'import sys,json; print(json.load(sys.stdin)["ANON_KEY"])')"; \
	SERVICE="$$(printf '%s' "$$STATUS" | python3 -c 'import sys,json; print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')"; \
	docker compose run --rm --no-deps -e SUPABASE_TEST_URL=http://host.docker.internal:54321 -e SUPABASE_TEST_ANON_KEY="$$ANON" -e SUPABASE_TEST_SERVICE_ROLE_KEY="$$SERVICE" app npm test

.PHONY: help dev install test typecheck lint check build npm sh dev-user test-db
