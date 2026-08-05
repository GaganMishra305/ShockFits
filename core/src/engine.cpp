#include <chrono>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include <random>
#include <sstream>
#include <string>

#include "shockfits/bitboard.hpp"
#include "shockfits/board.hpp"
#include "shockfits/movegen.hpp"
#include "shockfits/perft.hpp"
#include "shockfits/version.hpp"

// Temporary engine driver for the ShockFits transition.
//
// This still speaks the legacy "position <moves_csv> <fen>" / "go" protocol used
// by web/server.js, BUT the engine now generates its OWN legal moves in C++
// (no more relying on chess.js). Move selection is still random -- real search
// arrives in Phase 2. A `perft <depth>` command is included for debugging.
//
// Phase 3 replaces this whole file with a proper UCI implementation.

using namespace shockfits;

namespace {

Move pick_random_legal(Board& board) {
    MoveList moves;
    generate_legal(board, moves);
    if (moves.size() == 0) return kNullMove;

    static std::mt19937 rng(static_cast<unsigned>(std::time(nullptr)));
    std::uniform_int_distribution<std::size_t> dist(0, moves.size() - 1);
    return moves[dist(rng)];
}

// Extract the FEN from a "position <moves_csv> <fen>" line. The moves_csv is a
// single whitespace-delimited token; everything after it is the FEN.
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

    Board board;  // defaults to startpos
    std::string line;

    std::cerr << "[ENGINE] " << kEngineName << " v" << kVersionString
              << " started (self-generating legal moves)" << std::endl;

    while (std::getline(std::cin, line)) {
        if (line == "quit") break;

        if (line.rfind("position", 0) == 0) {
            std::string fen = parse_position_fen(line);
            if (!fen.empty() && !board.set_fen(fen)) {
                std::cerr << "[ENGINE] bad FEN: " << fen << std::endl;
            }
            MoveList legal;
            generate_legal(board, legal);
            std::cerr << "[ENGINE] position set, " << legal.size()
                      << " legal moves" << std::endl;
            continue;
        }

        if (line == "go") {
            Move best = pick_random_legal(board);
            std::cout << (best.is_null() ? "(none)" : best.to_uci())
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
            auto t1 = std::chrono::steady_clock::now();
            double sec =
                std::chrono::duration<double>(t1 - t0).count();
            std::cout << "perft(" << depth << ") = " << nodes << "  ("
                      << sec << "s, "
                      << (sec > 0 ? (std::uint64_t)(nodes / sec) : nodes)
                      << " nps)" << std::endl;
            std::cout.flush();
            continue;
        }

        std::cerr << "[ENGINE] unknown command: " << line << std::endl;
    }
    return 0;
}
