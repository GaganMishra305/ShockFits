#include "shockfits/test.hpp"

// Single entry point that runs every TEST() registered across the test TU's.
int main() {
    return shockfits::test::run_all();
}
