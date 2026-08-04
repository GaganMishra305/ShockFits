# ShockFits 

A fast, multithreaded **C++ chess engine** (targeting UCI) with a web UI to play
your best bots, run a **Bots Royale**, and a **Stockfish Gauntlet**.

Inspired by Sebastian Lague's [Chess-Coding-Adventure](https://github.com/SebLague/Chess-Coding-Adventure).

> **Status:** Phase 0 complete (build system + structure + tests). See
> [`PLAN.md`](PLAN.md) for the full phase-wise roadmap.

## Repo layout
```
core/
  include/shockfits/   # public headers (version, test harness, ...)
  src/                 # engine sources (evaluate.cpp, engine.cpp, ...)
  tests/               # perft + unit tests (zero-dependency harness)
  CMakeLists.txt
bench/                 # benchmarks (nps, tactical suites) — Phase 8
tools/                 # tournament / gauntlet helpers — Phase 6
web/                   # Express + chessboard.js UI
CMakeLists.txt         # top-level build
PLAN.md                # phase-wise development plan
```

## Build the engine (CMake)
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```
The engine binary is emitted at `core/engine` (kept there so `web/server.js`
can spawn it during the transition).

## Run the tests
```bash
cd build && ctest --output-on-failure
# or run the binary directly for verbose output:
./core/tests/shockfits_tests
```

## Run the web UI
```bash
cd web
npm install
npm start          # http://localhost:3000
```

## References
- [Chess Programming Wiki](https://www.chessprogramming.org/)
- https://dev.to/zeyu2001/build-a-simple-chess-ai-in-javascript-18eg
