#include "shockfits/tt.hpp"

#include <bit>

namespace shockfits {

void TranspositionTable::resize(std::size_t mb) {
    std::size_t bytes = mb * 1024 * 1024;
    std::size_t count = bytes / sizeof(TTEntry);
    if (count < 1024) count = 1024;

    // Round down to a power of two so we can index with a bit-mask.
    std::size_t pow2 = std::bit_floor(count);
    table_.assign(pow2, TTEntry{});
    mask_ = pow2 - 1;
}

void TranspositionTable::clear() {
    for (auto& e : table_) e = TTEntry{};
}

void TranspositionTable::store(std::uint64_t key, int score, Bound bound,
                               int depth, Move move) {
    TTEntry& e = table_[index(key)];
    // Depth-preferred replacement: keep deeper analysis unless it's a new
    // position or an exact score at >= depth.
    if (e.key == key && e.depth > depth && bound != BOUND_EXACT) return;

    e.key = key;
    e.score = score;
    e.bound = bound;
    e.depth = static_cast<std::int16_t>(depth);
    if (move != kNullMove || e.key != key) e.move = move;
}

}  // namespace shockfits
