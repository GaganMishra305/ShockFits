#include "shockfits/test.hpp"

#include <array>
#include <cstdint>
#include <string_view>

// ============================================================================
// Perft (performance test) reference data.
//
// Perft counts the number of leaf nodes at a given depth from a position. It is
// THE correctness gate for move generation (Phase 1). When the bitboard board
// + legal move generator exist, perft(depth) must EXACTLY match these numbers.
//
// Numbers below are the well-known published values from the Chess Programming
// Wiki (startpos + "Kiwipete" + a few standard tricky positions).
// ============================================================================

namespace {

struct PerftEntry {
    int depth;
    std::uint64_t nodes;
};

struct PerftPosition {
    std::string_view name;
    std::string_view fen;
    std::array<PerftEntry, 6> expected;  // depths 1..6 (0 == unused)
};

// Startpos
constexpr PerftPosition kStartPos{
    "startpos",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    {{{1, 20}, {2, 400}, {3, 8902}, {4, 197281}, {5, 4865609}, {6, 119060324}}}};

// Kiwipete — dense tactical position, catches most movegen bugs.
constexpr PerftPosition kKiwipete{
    "kiwipete",
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    {{{1, 48}, {2, 2039}, {3, 97862}, {4, 4085603}, {5, 193690690}, {6, 0}}}};

// Position 3 (endgame, tricky pawn/ep interactions).
constexpr PerftPosition kPos3{
    "position3",
    "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    {{{1, 14}, {2, 191}, {3, 2812}, {4, 43238}, {5, 674624}, {6, 11030083}}}};

}  // namespace

// Phase 0: we can't run real perft yet (no board/movegen). We DO validate that
// the reference table is well-formed so it's trustworthy the moment Phase 1's
// perft() function is ready to be plugged in here.
TEST("perft reference data is well-formed") {
    for (const auto* pos : {&kStartPos, &kKiwipete, &kPos3}) {
        CHECK(!pos->name.empty());
        CHECK(!pos->fen.empty());
        // depth 1 must be a plausible legal-move count for any legal position.
        CHECK(pos->expected[0].depth == 1);
        CHECK(pos->expected[0].nodes > 0);
    }
    CHECK_EQ(kStartPos.expected[0].nodes, 20u);
    CHECK_EQ(kKiwipete.expected[0].nodes, 48u);
}

// TODO(Phase 1): once shockfits::Board + perft() exist, replace the above with:
//
//   TEST("perft matches known node counts") {
//       for (const auto* pos : {&kStartPos, &kKiwipete, &kPos3}) {
//           Board b(pos->fen);
//           for (auto [depth, nodes] : pos->expected) {
//               if (nodes == 0) continue;  // skip un-tabulated depths
//               CHECK_EQ(perft(b, depth), nodes);
//           }
//       }
//   }
