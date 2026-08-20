# ShockFits

[![CI](https://github.com/GaganMishra305/ShockFits/actions/workflows/ci.yml/badge.svg)](https://github.com/GaganMishra305/ShockFits/actions/workflows/ci.yml)

### Current bot level: ~2450 Elo

*(performance rating for `shockfits-blitz` at 100 ms/move, measured vs Stockfish
with calibrated `UCI_Elo` — see [Measuring strength](#measuring-strength-elo).)*

### Watch it play

https://github.com/GaganMishra305/ShockFits/releases/download/v0.1.0/shockfits-demo.mp4

<video src="https://github.com/GaganMishra305/ShockFits/releases/download/v0.1.0/shockfits-demo.mp4" poster="docs/arena.png" controls width="100%">
  Your browser can't play this video —
  <a href="https://github.com/GaganMishra305/ShockFits/releases/download/v0.1.0/shockfits-demo.mp4">download the demo</a>
  or see the still below.
</video>

![ShockFits arena — shockfits-blitz checkmates Stockfish](docs/arena.png)

*The browser arena: watch bots fight live (with per-move think times), then scrub
the replay. Above, `shockfits-blitz` mates `stockfish-skill3`.*

A chess engine built **from scratch in C++** — bitboards, alpha-beta search,
a lock-free transposition table, Lazy-SMP multithreading, and the UCI protocol —
with a browser **arena** to play it, watch bots fight live, and pit it against
Stockfish across thousands of games.

Inspired by Sebastian Lague's
[Chess-Coding-Adventure](https://github.com/SebLague/Chess-Coding-Adventure).

---

## What's inside

**Engine (C++20, `core/`)**
- **Bitboard** board representation (LERF), fully legal move generation
  (**perft-verified** on startpos, Kiwipete, and positions 3/4/5)
- **Negamax + alpha-beta**, iterative deepening, quiescence, check extensions
- **Null-move pruning**, **late move reductions (LMR)**, principal-variation search
- Move ordering: TT move, MVV-LVA, killer moves, history heuristic
- **Tapered PeSTO evaluation** (midgame/endgame interpolation)
- **Zobrist hashing** + **lock-free transposition table** (Hyatt XOR scheme)
- **Lazy-SMP multithreading** (opt-in, hard-capped to the machine's cores)
- Full **UCI** implementation — plugs into any GUI or `cutechess`-style tooling

**Arena (Python + web, `tools/` + `web/`)**
- Bot **registry**: versioned fighters (engine + UCI options + search limit)
- **Match runner / tournaments**: Bots Royale (round-robin, crosstable, Elo) and
  a Stockfish Gauntlet (Elo + SPRT), driven by `python-chess` as referee
- **Elo calibration** ladder vs Stockfish `UCI_Elo`
- **Browser arena**: pick White & Black (Human or any bot / Stockfish level),
  play interactively, or watch bot-vs-bot **live** and scrub the replay — with
  per-move think times

---

## Quick start

### Build the engine
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j          # emits core/engine
ctest --test-dir build          # perft + search + uci tests
```

### Set up the arena tooling
```bash
uv venv
uv pip install -r tools/requirements.txt \
  --index-url https://pypi.ci.artifacts.walmart.com/artifactory/api/pypi/external-pypi/simple \
  --allow-insecure-host pypi.ci.artifacts.walmart.com
brew install stockfish          # opponent for gauntlet/calibration
```

### Play in the browser
```bash
cd web && npm install && npm start   # http://localhost:3000
```

---

## Arena CLI

```bash
# round-robin among registered bots
.venv/bin/python -m tools.arena.cli royale --games 6

# a bot vs Stockfish (Elo + SPRT verdict)
.venv/bin/python -m tools.arena.cli gauntlet shockfits-blitz --games 20

# measure a bot's Elo vs calibrated Stockfish
.venv/bin/python -m tools.arena.calibrate --bot shockfits-blitz --games 12 --movetime 100
```

---

## Measuring strength (Elo)

`tools.arena.calibrate` plays the bot against Stockfish at several
`UCI_LimitStrength` / `UCI_Elo` "rungs" (both sides on the same movetime, so the
number means *strength at that time control*). Each rung yields a score rate; the
headline is the **50% crossover** (the Stockfish Elo it plays evenly with), and a
performance rating is averaged over the near-even rungs.

Latest run — `shockfits-blitz` @ 100 ms/move (20 games/rung), *with null-move
pruning + LMR*:

| Stockfish `UCI_Elo` | Score | Perf |
|---:|---:|---:|
| 2200 | 72% | 2368 |
| 2500 | 45% | 2465 |
| 2800 | 28% | 2632 |
| 3050 | 10% | 2668 |
| 3190 | 12% | 2852 |

**Headline: ~2445 Elo** (50% crossover; near-even perf rating ~2488). It now even
steals the occasional draw/win off Stockfish pegged at 3190.

> Caveats: fast time control, and Stockfish's `UCI_Elo` is itself an
> approximation, so read this as "plays around 2450 blitz strength," not a
> rating-list number. Performance rating is only averaged over rungs where the
> score is 20-80% (it breaks down against far-stronger opponents).

---

## Continuous integration & benchmarks

[GitHub Actions](.github/workflows/ci.yml) runs on every push / PR:
- **Engine** (Ubuntu + macOS): CMake build + `ctest` — the **perft** correctness
  gate plus search & UCI tests — then an informational `bench`.
- **Registry** (Python, stdlib only): unit tests + `arena validate` on the roster.

Benchmark the engine's search speed locally (deterministic, single-threaded):
```bash
bench/bench.sh            # depth 8 over a standard position set
bench/bench.sh core/engine 9
# -> bench depth 8 nodes 49102848 time 10671ms nps 4601165
```

## Repo layout
```
core/    C++ engine (include/, src/, tests/) + CMake
tools/   Python arena: bot registry, match runner, tournaments, calibration
bots/    committed bot manifests (the roster)
web/     browser arena (Node/Express + chessboard.js)
PLAN.md  phase-by-phase development log
```

## References
- [Chess Programming Wiki](https://www.chessprogramming.org/)
- Sebastian Lague — Chess-Coding-Adventure
