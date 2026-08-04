#include "shockfits/test.hpp"
#include "shockfits/version.hpp"

#include <string>

// Phase 0 smoke tests: prove the build + test harness actually work end-to-end.
// These get fleshed out with real engine assertions as Phase 1+ lands.

TEST("harness sanity: arithmetic") {
    CHECK(2 + 2 == 4);
    CHECK_EQ(6 * 7, 42);
}

TEST("version metadata is wired up") {
    CHECK_EQ(shockfits::kVersionMajor, 0);
    CHECK(std::string(shockfits::kVersionString) == "0.1.0");
    CHECK(std::string(shockfits::kEngineName) == "ShockFits");
}
