#include "shockfits/bitboard.hpp"
#include "shockfits/eval.hpp"
#include "shockfits/test.hpp"
#include "shockfits/zobrist.hpp"

// Single entry point that runs every TEST() registered across the test TU's.
int main() {
    shockfits::init_attacks();  // required before any move generation
    shockfits::zobrist::init();
    shockfits::init_eval();
    return shockfits::test::run_all();
}
