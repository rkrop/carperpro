#!/usr/bin/env bash
# Wrapper para correr OpenAI Codex CLI en este proyecto.
#
# Uso:
#   ./scripts/codex.sh exec "audita el módulo de checkout y reporta riesgos"
#   ./scripts/codex.sh                          # modo interactivo (TUI)
#   ./scripts/codex.sh --sandbox workspace-write exec "aplica las mejoras propuestas"
#
# Usa la API key del secreto OPENAI_REPLIT y la configuración en .codex/config.toml.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -z "${OPENAI_REPLIT:-}" ]; then
  echo "ERROR: falta el secreto OPENAI_REPLIT (API key de OpenAI)." >&2
  echo "Configúrelo en la pestaña Secrets de Replit y vuelva a intentar." >&2
  exit 1
fi

# Codex CLI lee la key desde OPENAI_API_KEY; reutilizamos OPENAI_REPLIT.
export OPENAI_API_KEY="$OPENAI_REPLIT"
# Mantener la configuración del proyecto (modelo, sandbox) dentro del repo.
export CODEX_HOME="$ROOT_DIR/.codex"

exec pnpm exec codex "$@"
