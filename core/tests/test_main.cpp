#include "shockfits/bitboard.hpp"
#include "shockfits/test.hpp"

// Single entry point that runs every TEST() registered across the test TU's.
int main() {
    shockfits::init_attacks();  // required before any move generation
    return shockfits::test::run_all();
}
