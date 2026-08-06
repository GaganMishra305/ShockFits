#pragma once

// Transposition table: caches search results keyed by Zobrist hash so we don't
// re-search positions reached by different move orders (transpositions).

#include <cstdint>
#include <vector>

#include "shockfits/types.hpp"

namespace shockfits {

enum Bound : std::uint8_t {
    BOUND_NONE = 0,
    BOUND_UPPER = 1,  // fail-low: score is an upper bound (alpha)
    BOUND_LOWER = 2,  // fail-high: score is a lower bound (beta)
    BOUND_EXACT = 3
};

struct TTEntry {
    std::uint64_t key = 0;
    std::int32_t score = 0;
    Move move = kNullMove;
    std::int16_t depth = -1;
    Bound bound = BOUND_NONE;
};

class TranspositionTable {
   public:
    explicit TranspositionTable(std::size_t mb = 64) { resize(mb); }

    void resize(std::size_t mb);
    void clear();

    // Probe: returns pointer to a matching entry (same key) or nullptr.
    const TTEntry* probe(std::uint64_t key) const {
        const TTEntry& e = table_[index(key)];
        return e.key == key ? &e : nullptr;
    }

    void store(std::uint64_t key, int score, Bound bound, int depth, Move move);

   private:
    std::size_t index(std::uint64_t key) const { return key & mask_; }

    std::vector<TTEntry> table_;
    std::size_t mask_ = 0;
};

}  // namespace shockfits
