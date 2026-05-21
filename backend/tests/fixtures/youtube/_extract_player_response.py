"""Helper to extract ytInitialPlayerResponse from a Decodo raw response.

Reads ``_decodo_raw_response.json`` (the Decodo envelope) and writes the
inner ``ytInitialPlayerResponse`` object as ``watch_decodo_player_response.json``.

Run once to capture the fixture. Then this helper itself can stay alongside the
fixture as documentation of how it was generated.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "_decodo_raw_response.json"
OUT = HERE / "watch_decodo_player_response.json"

PLAYER_RE = re.compile(r"ytInitialPlayerResponse\s*=\s*({.+?});", re.DOTALL)


def main() -> int:
    if not RAW.exists():
        print(f"Missing raw response at {RAW}", file=sys.stderr)
        return 1
    envelope = json.loads(RAW.read_text(encoding="utf-8"))
    results = envelope.get("results") or []
    if not results:
        print("envelope has no 'results' array", file=sys.stderr)
        return 1
    html = results[0].get("content") or ""
    if len(html) < 50_000:
        print(f"content too short ({len(html)} bytes)", file=sys.stderr)
        return 1
    m = PLAYER_RE.search(html)
    if not m:
        print("ytInitialPlayerResponse not found in HTML", file=sys.stderr)
        return 1
    try:
        player = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        print(f"player_response JSON parse error: {e}", file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(player, indent=2), encoding="utf-8")
    vd = player.get("videoDetails", {})
    print(
        f"OK: wrote {OUT.name} ({OUT.stat().st_size:,} bytes); "
        f"videoId={vd.get('videoId')} title={vd.get('title')!r} "
        f"lengthSeconds={vd.get('lengthSeconds')}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
