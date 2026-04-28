# vault-mcp

MCP server (read-only) exposing Maxime's Obsidian vault to all Claude clients (Code CLI, Cowork, web, Desktop).

See spec: `../docs/superpowers/specs/2026-04-28-vault-mcp-server-design.md`

## Local dev

```bash
cd vault-mcp
pip install -e ".[dev]"
export VAULT_PATH=/path/to/vault
export VAULT_MCP_TOKEN=$(openssl rand -hex 32)
uvicorn vault_mcp.server:app --port 8081
```

## Tests

```bash
pytest
```
