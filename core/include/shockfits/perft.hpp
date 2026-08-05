#pragma once

// Perft: count leaf nodes at a given depth. The correctness oracle for movegen.

#include <cstdint>

#include "shockfits/board.hpp"

namespace shockfits {

std::uint64_t perft(Board& b, int depth);

}  // namespace shockfits
