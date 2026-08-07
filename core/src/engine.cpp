#include <chrono>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>

#include "shockfits/bitboard.hpp"
#include "shockfits/board.hpp"
#include "shockfits/eval.hpp"
#include "shockfits/movegen.hpp"
#include "shockfits/perft.hpp"
#include "shockfits/search.hpp"
#include "shockfits/version.hpp"
#include "shockfits/zobrist.hpp"

// Temporary engine driver for the ShockFits transition.
//
// Speaks the legacy "position <moves_csv> <fen>" / "go" protocol used by
// web/server.js, but now runs a REAL search (negamax + alpha-beta + iterative
// deepening + quiescence + TT). Supports "go", "go depth N", "go movetime N",
// and a "perft <depth>" debug command.
//
// Phase 3 replaces this file with a proper UCI implementation.

using namespace shockfits;

namespace {

std::string parse_position_fen(const std::string& line) {
    std::istringstream ss(line);
    std::string cmd, moves_csv;
    ss >> cmd >> moves_csv;
    std::string fen;
    std::getline(ss, fen);
    if (!fen.empty() && fen.front() == ' ') fen.erase(0, 1);
    return fen;
}

}  // namespace

int main() {
    init_attacks();
    zobrist::init();
    init_eval();

    Board board;
    Searcher searcher(64);

    std::cerr << "[ENGINE] " << kEngineName << " v" << kVersionString
              << " started (alpha-beta search online)" << std::endl;

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line == "quit") break;

        if (line.rfind("position", 0) == 0) {
            std::string fen = parse_position_fen(line);
            if (!fen.empty() && fen != "-" && !board.set_fen(fen)) {
                std::cerr << "[ENGINE] bad FEN: " << fen << std::endl;
            }
            continue;
        }

        if (line.rfind("go", 0) == 0) {
            std::istringstream ss(line);
            std::string cmd, tok;
            ss >> cmd;
            SearchLimits limits;
            limits.max_depth = 64;
            limits.movetime_ms = 1000;  // default think time
            while (ss >> tok) {
                if (tok == "depth") {
                    ss >> limits.max_depth;
                    limits.movetime_ms = 0;
                } else if (tok == "movetime") {
                    ss >> limits.movetime_ms;
                }
            }
            SearchResult r = searcher.search(board, limits, /*verbose=*/true);
            std::cout << (r.best.is_null() ? "(none)" : r.best.to_uci())
                      << std::endl;
            std::cout.flush();
            continue;
        }

        if (line.rfind("perft", 0) == 0) {
            std::istringstream ss(line);
            std::string cmd;
            int depth = 1;
            ss >> cmd >> depth;
            auto t0 = std::chrono::steady_clock::now();
            std::uint64_t nodes = perft(board, depth);
            double sec = std::chrono::duration<double>(
                             std::chrono::steady_clock::now() - t0)
                             .count();
            std::cout << "perft(" << depth << ") = " << nodes << "  (" << sec
                      << "s, " << (sec > 0 ? (std::uint64_t)(nodes / sec) : nodes)
                      << " nps)" << std::endl;
            std::cout.flush();
            continue;
        }

        if (line == "eval") {
            std::cout << "eval cp " << evaluate(board) << std::endl;
            std::cout.flush();
            continue;
        }

        std::cerr << "[ENGINE] unknown command: " << line << std::endl;
    }
    return 0;
}
