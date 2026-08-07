#pragma once

// Search: iterative-deepening negamax with alpha-beta pruning, quiescence,
// transposition table, and move ordering (TT move, MVV-LVA, killers, history).

#include <chrono>
#include <cstdint>
#include <string>

#include "shockfits/board.hpp"
#include "shockfits/tt.hpp"
#include "shockfits/types.hpp"

namespace shockfits {

struct SearchLimits {
    int max_depth = 64;         // hard depth cap
    std::int64_t movetime_ms = 0;  // 0 = no time limit (depth-limited)
    std::uint64_t max_nodes = 0;   // 0 = unlimited
};

struct SearchResult {
    Move best = kNullMove;
    int score = 0;
    int depth = 0;
    std::uint64_t nodes = 0;
};

class Searcher {
   public:
    explicit Searcher(std::size_t tt_mb = 64) : tt_(tt_mb) {}

    void set_tt_size(std::size_t mb) { tt_.resize(mb); }
    void new_game() { tt_.clear(); }

    // Search `b` under `limits`, printing UCI-style "info" lines if `verbose`.
    SearchResult search(Board& b, const SearchLimits& limits,
                        bool verbose = true);

   private:
    int negamax(Board& b, int depth, int alpha, int beta, int ply);
    int quiescence(Board& b, int alpha, int beta, int ply);

    // Walk the transposition table from the current position to build a
    // principal variation string (space-separated UCI moves).
    std::string pv_string(Board& b, int max_len);

    bool time_up();

    TranspositionTable tt_;
    std::uint64_t nodes_ = 0;
    bool stop_ = false;

    std::chrono::steady_clock::time_point start_;
    std::int64_t movetime_ms_ = 0;
    std::uint64_t max_nodes_ = 0;

    Move root_best_ = kNullMove;

    // Move-ordering heuristics.
    static constexpr int kMaxPly = 128;
    Move killers_[kMaxPly][2] = {};
    int history_[COLOR_NB][SQ_NB][SQ_NB] = {};
};

}  // namespace shockfits
