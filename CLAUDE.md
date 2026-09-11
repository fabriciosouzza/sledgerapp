@AGENTS.md

# sledger

- The build spec is `PROMPT.md`. Read it before changing anything; ask before deviating from it.
- Node is not installed on the host; everything runs in Docker. `docker compose up` serves
  the app; `make help` lists the rest (`make check`, `make npm args="..."`).
