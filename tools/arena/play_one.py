"""Play a single game between two fighters and print the result as JSON.

Used by the web arena to run a game on demand. A fighter is either a registered
bot name, or a Stockfish pseudo-bot of the form ``stockfish-skill<N>`` (skill
0-20). Output (stdout) is a single JSON object describing the game + moves so
the browser can replay it.

    python3 -m tools.arena.play_one --white shockfits-d6 --black stockfish-skill3
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Optional

from . import bots as reg
from .match import OPENING_BOOK, play_game

_SF_RE = re.compile(r"^stockfish-skill(\d+)$")


def resolve_fighter(name: str, sf_movetime: int) -> reg.Bot:
    """Return a Bot for a registered name or a stockfish-skill<N> pseudo-bot."""
    m = _SF_RE.match(name)
    if m:
        skill = max(0, min(20, int(m.group(1))))
        sf = shutil.which("stockfish") or "/opt/homebrew/bin/stockfish"
        if not Path(sf).is_file():
            raise SystemExit(f"stockfish not found at {sf}")
        return reg.Bot(name=name, engine=sf,
                       description=f"Stockfish skill {skill}",
                       options={"Skill Level": skill},
                       limits={"movetime": sf_movetime})
    bot = reg.get_bot(name)
    if bot is None:
        raise SystemExit(f"unknown fighter: {name!r}")
    if not bot.engine_exists():
        raise SystemExit(f"{name}: engine binary not built ({bot.engine_path()})")
    return bot


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="play_one")
    p.add_argument("--white", required=True)
    p.add_argument("--black", required=True)
    p.add_argument("--opening", type=int, default=0,
                   help="opening book index (default 0 = startpos)")
    p.add_argument("--sf-movetime", type=int, default=50,
                   help="ms/move for stockfish pseudo-bots")
    p.add_argument("--max-plies", type=int, default=400)
    args = p.parse_args(argv)

    white = resolve_fighter(args.white, args.sf_movetime)
    black = resolve_fighter(args.black, args.sf_movetime)
    opening = OPENING_BOOK[args.opening % len(OPENING_BOOK)]

    r = play_game(white, black, opening=opening, max_plies=args.max_plies)

    out = {
        "white": r.white,
        "black": r.black,
        "result": r.result,
        "termination": r.termination,
        "plies": r.plies,
        "moves_uci": r.moves_uci,
        "moves_san": r.moves_san,
        "fens": r.fens,
        "pgn": r.pgn,
    }
    json.dump(out, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
