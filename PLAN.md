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
**Outcome:** the UI you described (revised: an interactive arena, not a dashboard).
- Browser **arena**: pick two fighters (ShockFits bots or Stockfish skill levels),
  run a game on demand, and **replay it move-by-move** on a board.
- Node server spawns the Python match runner per request; game returns as JSON
  (SAN + FENs) for replay.
- (Dropped the analytics dashboard per owner request.)

## Phase 9 — README showcase (owner request, deferred)
**Outcome:** a repo front page that flexes.
- Header line: **"Current bot level: XXXX Elo"** (needs a calibrated gauntlet ladder
  vs increasing Stockfish strength to find the real ceiling).
- Embed a screenshot or short video of a bot-vs-bot replay from the arena.

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
- **Phase 1 — DONE:** bitboard core (`types`, `bitboard`, `board`, `movegen`,
  `perft`). LERF board, precomputed leaper attacks, ray-walked sliders, FEN
  I/O, make/unmake with undo stack, legal move generation (pseudo-legal +
  legality filter incl. castling transit checks & en passant). **Perft passes
  exactly** for startpos(d5), Kiwipete, and positions 3/4/5. Engine binary now
  generates its OWN legal moves (chess.js no longer needed for move logic) and
  has a `perft` debug command (~57M nps, ray-walk sliders).
- **Phase 2 — DONE:** the engine now THINKS. Tapered PeSTO evaluation
  (`eval`), Zobrist hashing (`zobrist`, incrementally maintained + verified),
  transposition table (`tt`, depth-preferred, bucketed by power-of-two mask),
  and search (`search`): iterative-deepening negamax + alpha-beta + quiescence
  + check extensions + move ordering (TT move, MVV-LVA, killers, history).
  Engine driver runs real search (`go` / `go depth N` / `go movetime N`, plus
  `eval`). Plays Nf3 from startpos, solves mate-in-1, grabs hanging material;
  ~7M nps full-width search. 13/13 tests green (perft + zobrist + eval +
  tactics).
- **Phase 3 — DONE:** ShockFits is now a real, pluggable **UCI engine**
  (`uci` module). Full handshake (`uci`/`isready`/`ucinewgame`), `setoption`
  (Hash, Threads-stored-for-P4), `position startpos|fen ... moves ...`, and
  `go` with depth/nodes/movetime/wtime+btime+inc+movestogo/infinite (+ simple
  time budgeting). Search emits proper `info` lines (mate scores as `mate N`,
  nps, TT-walked PV) and `bestmove`; unified all engine output through
  std::cout. `web/server.js` rewritten to drive the engine over UCI. 20/20
  tests green (added 7 UCI protocol tests). Ready to face Stockfish + run in
  cutechess-cli.
- **Phase 4 — DONE:** multithreading via **Lazy SMP** (safe by design). N
  worker threads each run their own iterative-deepening search on a private
  board, sharing one **lockless transposition table** (Hyatt XOR scheme, relaxed
  atomics — no locks, no UB). Safety rails: threads default to **1**, opt-in via
  UCI `Threads`, hard-capped to the machine's core count; the main worker
  dictates termination so helpers can never outlive it. Search now runs on a
  **background thread** so `stop`/`quit` interrupt `go infinite` cleanly (proven:
  stop-after-1s = 1.0s real). ~4× node throughput at 4 threads on M4 Pro. 23/23
  tests green (added 3 threaded-search tests).
- **Phase 5 — DONE:** **bot registry** (`tools/arena`). A bot = engine binary +
  UCI options + one search limit (movetime/depth/nodes), stored as committed
  JSON manifests in `bots/`. Stdlib-only CLI: `list`, `show`, `validate`, and
  `snapshot` (freezes the current binary into `bin/` and records the git commit
  for reproducibility). Seed roster is a strength ladder: `shockfits-d4/d6/d8`
  + `shockfits-blitz`. 11 Python tests green; committed roster validates.
- **Phase 6 — DONE:** **Bots Royale + Stockfish Gauntlet** live. Installed
  Stockfish 18 (brew). cutechess not in brew, so built a homegrown UCI match
  runner using `python-chess` as the referee (legality, draw/mate adjudication,
  PGN) — engine stays pure C++. `tools/arena`: `match` (opening book, per-game
  play), `rating` (Elo + 95% margin + SPRT/LLR), `tournament` (round-robin
  royale w/ crosstable; gauntlet w/ SPRT). CLI: `royale`, `gauntlet`. Results
  written to `web/data/*.json` (+ PGN). **Web dashboard** (`web/dashboard.html`
  + Chart.js): standings, Elo bars, crosstable, gauntlet W/D/L doughnut + SPRT
  verdict + recent games. Demo: ShockFits-blitz beat Stockfish(skill0,20ms)
  4-0 (SPRT H1 accepted); royale strength ladder validated blitz > d6 > d4.
- **Phase 7 — DONE:** interactive browser **arena** (owner asked for run+replay,
  not a dashboard — dashboard removed). `web/arena.html` lets you pick two
  fighters (ShockFits bots or Stockfish skill levels), run a game on demand, and
  replay it move-by-move (first/prev/next/last + autoplay, clickable move list,
  result banner). Node endpoints: `GET /api/bots`, `POST /api/arena/run` (spawns
  the Python `play_one` runner). `match.py` now records SAN/UCI/FEN per ply for
  replay. Verified end-to-end: blitz beat Stockfish-skill3 in-browser.
  **Update (live):** bot-vs-bot now **streams live** via Server-Sent Events
  (`GET /api/arena/stream` -> `play_one --stream`, one JSON line per move);
  board auto-follows the newest move and you can scrub back any time. The Play
  page gained a **bot picker** (any ShockFits config or Stockfish skill level)
  wired to `POST /api/bot-move` (`bot_move.py`), so a human can face any bot.
- **Phase 9 (deferred, owner idea):** README header "Current bot level: XXXX
  Elo" (needs a calibration ladder) + an embedded replay screenshot/video.

- **Phase 9 — DONE (Elo + UI glow-up):** built `tools.arena.calibrate` — ladders
  a bot vs Stockfish `UCI_LimitStrength`/`UCI_Elo` rungs, reports a games-weighted
  performance rating + 50% crossover, writes `web/data/elo.json` +
  committed `docs/elo.json`. Result: `shockfits-blitz` @ 100ms ~ **2447 Elo**
  (crossover ~2775). README rewritten with the "Current bot level" header and
  honest methodology/caveats. UI: **unified** Play + Arena into one page
  (`/api/elo` badge, dark theme), Human selectable per side; human games are
  interactive, bot-vs-bot streams live + scrubbable. Removed the separate arena
  page. (Screenshot/replay clip in README still TODO.)
- **Phase 8 — DONE (CI + polish):** GitHub Actions (`.github/workflows/ci.yml`)
  on every push/PR: engine build + `ctest` (perft/search/uci) on **ubuntu +
  macos**, plus an informational `bench`; separate Python job runs registry unit
  tests + `arena validate` (dependency-free — `cli` lazy-imports the chess-using
  modules). Added a UCI **`bench`** command (deterministic fixed-depth nps over a
  position set) + `bench/bench.sh`. First CI run green on all 3 jobs.
- **Elo (tightened):** re-ran calibration at **20 games/rung** — clean monotonic
  ladder, perf **2396**, 50% crossover exactly **2400** (methods agree).
  Headline is **~2400 Elo**. README screenshot refreshed (2396 badge, blitz
  mates stockfish-skill3) — screenshot TODO now resolved.

## Definition of done (the "win")
1. ShockFits is a UCI, multithreaded C++ engine that generates its own moves & searches.
2. UI lets you play any bot version, run a Bots Royale, and a Stockfish Gauntlet.
3. We can run thousands of games and report Elo + SPRT verdicts with charts.
