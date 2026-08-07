#include "shockfits/bitboard.hpp"
#include "shockfits/eval.hpp"
#include "shockfits/uci.hpp"
#include "shockfits/zobrist.hpp"

// ShockFits engine entry point: a UCI-speaking chess engine.
//
// Initializes the static tables, then hands control to the UCI loop. Any UCI
// GUI or tournament tool (cutechess-cli, Cute Chess, Arena) can now drive it,
// including matches against Stockfish.

int main() {
    shockfits::init_attacks();
    shockfits::zobrist::init();
    shockfits::init_eval();

    shockfits::Uci uci;
    uci.loop();
    return 0;
}
