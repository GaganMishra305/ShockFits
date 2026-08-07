#include "shockfits/uci.hpp"

#include <algorithm>
#include <iostream>
#include <sstream>
#include <string>

#include "shockfits/eval.hpp"
#include "shockfits/movegen.hpp"
#include "shockfits/perft.hpp"
#include "shockfits/version.hpp"

namespace shockfits {

Uci::Uci() : searcher_(64) {}  // 64 MB default TT (matches hash_mb_ default)

Move Uci::parse_move(const std::string& uci) const {
    Board copy = board_;
    MoveList legal;
    generate_legal(copy, legal);
    for (Move m : legal)
        if (m.to_uci() == uci) return m;
    return kNullMove;
}

void Uci::cmd_uci() {
    std::cout << "id name " << kEngineName << ' ' << kVersionString << "\n";
    std::cout << "id author " << kAuthor << "\n";
    std::cout << "option name Hash type spin default 64 min 1 max 4096\n";
    std::cout << "option name Threads type spin default 1 min 1 max 256\n";
    std::cout << "uciok\n";
    std::cout.flush();
}

void Uci::cmd_isready() {
    std::cout << "readyok\n";
    std::cout.flush();
}

void Uci::cmd_newgame() {
    searcher_.new_game();
    board_.set_startpos();
}

void Uci::cmd_setoption(const std::string& args) {
    // Format: name <Name> value <Value>
    std::istringstream ss(args);
    std::string tok, name, value;
    ss >> tok;  // "name"
    // Names can be multi-word; collect until "value".
    while (ss >> tok && tok != "value") {
        if (!name.empty()) name += ' ';
        name += tok;
    }
    ss >> value;

    if (name == "Hash") {
        hash_mb_ = std::max(1, std::stoi(value));
        searcher_.set_tt_size(hash_mb_);
    } else if (name == "Threads") {
        threads_ = std::max(1, std::stoi(value));
        // Applied in Phase 4 (Lazy SMP).
    }
}

void Uci::cmd_position(const std::string& args) {
    std::istringstream ss(args);
    std::string tok;
    ss >> tok;

    if (tok == "startpos") {
        board_.set_startpos();
        ss >> tok;  // maybe "moves"
    } else if (tok == "fen") {
        std::string fen;
        // FEN is 6 space-separated fields.
        for (int i = 0; i < 6 && ss >> tok && tok != "moves"; ++i) {
            if (!fen.empty()) fen += ' ';
            fen += tok;
        }
        board_.set_fen(fen);
        // tok currently holds "moves" or the last FEN field; normalize.
        if (tok != "moves") ss >> tok;
    }

    if (tok == "moves") {
        std::string mv;
        while (ss >> mv) {
            Move m = parse_move(mv);
            if (m.is_null()) break;  // illegal / malformed; stop applying
            board_.make_move(m);
        }
    }
}

void Uci::cmd_go(const std::string& args) {
    std::istringstream ss(args);
    std::string tok;

    SearchLimits limits;
    limits.max_depth = 64;
    std::int64_t wtime = 0, btime = 0, winc = 0, binc = 0, movetime = 0;
    int movestogo = 0;
    bool infinite = false;

    while (ss >> tok) {
        if (tok == "depth") ss >> limits.max_depth;
        else if (tok == "nodes") ss >> limits.max_nodes;
        else if (tok == "movetime") ss >> movetime;
        else if (tok == "wtime") ss >> wtime;
        else if (tok == "btime") ss >> btime;
        else if (tok == "winc") ss >> winc;
        else if (tok == "binc") ss >> binc;
        else if (tok == "movestogo") ss >> movestogo;
        else if (tok == "infinite") infinite = true;
    }

    if (movetime > 0) {
        limits.movetime_ms = movetime;
    } else if (!infinite && (wtime > 0 || btime > 0)) {
        // Simple time budget: share of remaining time + increment, with margin.
        std::int64_t my_time = (board_.side_to_move() == WHITE) ? wtime : btime;
        std::int64_t my_inc = (board_.side_to_move() == WHITE) ? winc : binc;
        int moves = movestogo > 0 ? movestogo : 30;
        std::int64_t budget = my_time / moves + my_inc;
        // Never use more than ~half the remaining clock; keep a small margin.
        budget = std::min(budget, my_time / 2);
        limits.movetime_ms = std::max<std::int64_t>(5, budget - 10);
    }
    // else: depth/nodes/infinite -> no time cap (infinite runs to max_depth).

    SearchResult r = searcher_.search(board_, limits, /*verbose=*/true);
    std::cout << "bestmove " << (r.best.is_null() ? "0000" : r.best.to_uci())
              << "\n";
    std::cout.flush();
}

bool Uci::handle(const std::string& line) {
    std::istringstream ss(line);
    std::string cmd;
    ss >> cmd;
    std::string rest;
    std::getline(ss, rest);
    if (!rest.empty() && rest.front() == ' ') rest.erase(0, 1);

    if (cmd == "uci") cmd_uci();
    else if (cmd == "isready") cmd_isready();
    else if (cmd == "ucinewgame") cmd_newgame();
    else if (cmd == "setoption") cmd_setoption(rest);
    else if (cmd == "position") cmd_position(rest);
    else if (cmd == "go") cmd_go(rest);
    else if (cmd == "stop") { /* single-threaded: search already returned */ }
    else if (cmd == "eval") std::cout << "eval cp " << evaluate(board_) << "\n";
    else if (cmd == "perft") {
        int depth = rest.empty() ? 1 : std::stoi(rest);
        std::cout << "nodes " << perft(board_, depth) << "\n";
    }
    else if (cmd == "d") std::cout << board_.fen() << "\n";
    else if (cmd == "quit") return false;
    // Unknown commands are silently ignored, per UCI convention.
    std::cout.flush();
    return true;
}

void Uci::loop() {
    std::string line;
    while (std::getline(std::cin, line)) {
        if (!handle(line)) break;
    }
}

}  // namespace shockfits
