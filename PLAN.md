# ShockFits — Phase-Wise Development Plan

> Goal: A fast, multithreaded **C++ chess engine** + a UI to (a) play your best bots,
> (b) run a **Bots Royale** to crown the strongest bot, and (c) run a **Stockfish
> Gauntlet** — thousands of games against Stockfish with proper strength evaluation.
> Inspiration: Sebastian Lague's *Chess-Coding-Adventure*.

---

## 0. Where we are today (baseline audit)

| Area | Status | Reality check |
|------|--------|---------------|
| C++ engine (`core/engine.cpp`) | stdin/stdout loop | Picks a **random** legal move; legal moves come from chess.js in the browser. |
| Evaluation (`core/evaluate.cpp`) | Material + PST tables | Correct-looking, but **never called** by the move decision. Dead code. |
| Web UI (`web/`) | Express + chessboard.js | Works. HvH / HvC / CvC modes. Reusable. |
| Concurrency | Single shared engine process | Race condition; cannot scale to many parallel games. |
| Protocol | Custom `position/go` | Not UCI → can't talk to Stockfish or standard GUIs/tournament tools. |
| Multithreading | None | A stated project goal, currently unused. |
| Tournament / benchmark harness | None | Required for Bots Royale + Stockfish Gauntlet. |

**Reusable assets:** piece-square tables & material weights, the whole `web/` front-end,
the chessboard piece art, the general client architecture.

---

## Guiding principles
- **UCI is the backbone.** Everything (GUI, Stockfish matches, tournaments) speaks UCI.
- **Correctness before cleverness.** Perft tests gate every move-gen change.
- **Measure everything.** No eval/search change ships without a regression match (SPRT).
- DRY / YAGNI / SOLID. Keep files < 600 lines. Obey the Zen of Python everywhere.

---

## Phase 0 — Foundations & repo hygiene
**Outcome:** a real build system and clean structure.
- Add `.gitignore` (build artifacts, `node_modules`, `.vscode`, binaries).
- Introduce **CMake** build (`core/` → `shockfits` engine binary).
- Restructure: `core/src`, `core/include`, `core/tests`, `bench/`, `tools/`.
- Add a tiny unit-test harness (Catch2 or doctest) + `perft` scaffold.
- Write this PLAN.md and a build README.

## Phase 1 — Real board & legal move generation (C++)
**Outcome:** C++ owns the game state. No more relying on chess.js.
- **Bitboard** board representation (64-bit per piece type/color).
- FEN parse + serialize; make/unmake move (with undo stack).
- Legal move generation: pawns (incl. en passant, promotion), knights, kings,
  castling, and sliding pieces (start simple; magic bitboards later).
- **Perft** correctness tests against known node counts (depths 1–6 from startpos +
  the standard "Kiwipete" and other test positions). This is the gate.

## Phase 2 — Search & evaluation (the engine actually thinks)
**Outcome:** it plays real chess, using your eval.
- Negamax + **alpha-beta** pruning, **iterative deepening**.
- **Quiescence search** (avoid horizon effect on captures).
- Move ordering: MVV-LVA, killer moves, history heuristic.
- **Transposition table** with **Zobrist hashing**.
- Wire in existing material + PST eval; add **tapered eval** (midgame↔endgame),
  basic mobility / king safety / pawn structure.
- Time management (search to a time budget, not fixed depth).

## Phase 3 — UCI protocol
**Outcome:** ShockFits is a real, pluggable engine.
- Implement `uci`, `isready`, `ucinewgame`, `position`, `go`, `stop`, `quit`,
  `info`/`bestmove` output.
- Verify in a standard GUI (Arena / Cute Chess / BanksiaGUI).
- **This is what lets us fight Stockfish and run tournaments.**

## Phase 4 — Multithreading (use the full compute)
**Outcome:** the "C++ for speed + threads" promise delivered.
- **Lazy SMP**: N search threads sharing one transposition table.
- Thread pool, lock-light/lockless TT, `go` respects `Threads` UCI option.
- Benchmark nodes/sec scaling vs thread count.

## Phase 5 — Bot registry & versioning
**Outcome:** many "bots" to pit against each other.
- A **bot** = engine binary + config (eval weights, search settings, UCI options).
- Version snapshots (e.g., `shockfits-v1`, `-v2`) so we can measure real progress.
- Simple JSON/TOML bot manifest + a loader.

## Phase 6 — Tournament & evaluation harness
**Outcome:** Bots Royale + Stockfish Gauntlet, at scale.
- Match runner over N games with opening book, color balancing, PGN output.
  (Decision pending: **`cutechess-cli`** (battle-tested) vs a homegrown C++ runner.)
- **Bots Royale:** round-robin / Swiss among our bot versions → standings + Elo.
- **Stockfish Gauntlet:** thousands of games vs Stockfish (skill-capped / node-limited
  for fair curves); compute **Elo** + **SPRT** for statistically sound verdicts.
- Parallelize matches across cores (this is where threads shine at the harness level too).

## Phase 7 — Web UI overhaul
**Outcome:** the UI you described.
- Fix backend concurrency: **per-game engine process pool** (no more shared singleton).
- **Play** tab: pick a bot version, human vs bot, live eval bar, PGN move list.
- **Bots Royale** dashboard: live standings, crosstable, Elo chart (Chart.js).
- **Stockfish Gauntlet** dashboard: run N games, live win/draw/loss + Elo curve.
- Analysis niceties: eval bar, best-move arrows, PGN import/export.

## Phase 8 — Polish, CI & docs
**Outcome:** trustworthy and maintainable.
- CI runs perft + a fast regression match on each change (SPRT gate).
- Benchmark suite (nps, depth, tactical test suites like WAC/ECM).
- Docs: architecture, how to add a bot, how to run a gauntlet.

---

## Confirmed tech decisions
- **Board:** bitboards — fastest, thread-friendly, industry standard.
- **Protocol:** UCI.
- **Multithreading:** Lazy SMP.
- **Harness:** `cutechess-cli` (don't reinvent); homegrown later only if needed.
- **Backend:** keep Node/Express as a thin orchestrator that spawns UCI engines
  per game (revisit if it becomes a bottleneck).
- **Charts/reports:** flat HTML + Chart.js for gauntlet/royale dashboards.
- **Commits:** normal real timestamps (no backdating).

## Progress log
- **Phase 0 — DONE:** CMake build (C++20), repo restructured into
  `core/{include,src,tests}`, zero-dependency test harness, perft reference
  table seeded, portability fix (`bits/stdc++.h` removed), Linux binary
  untracked, `.gitignore` hardened. Build + tests green on macOS/clang.

## Definition of done (the "win")
1. ShockFits is a UCI, multithreaded C++ engine that generates its own moves & searches.
2. UI lets you play any bot version, run a Bots Royale, and a Stockfish Gauntlet.
3. We can run thousands of games and report Elo + SPRT verdicts with charts.
