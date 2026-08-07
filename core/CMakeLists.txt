# ---- ShockFits engine core --------------------------------------------------

# Reusable engine logic lives in a library so both the executable and the
# tests can link against it (DRY: one source of truth for engine code).
#
# NOTE (Phase 0): today evaluate.cpp is the only real engine module and
# engine.cpp still holds a temporary main() with the legacy stdin loop.
# As Phase 1+ lands (board, movegen, search, uci), new .cpp files get added
# to SHOCKFITS_LIB_SOURCES below and main() moves to src/main.cpp.

set(SHOCKFITS_LIB_SOURCES
    src/bitboard.cpp
    src/board.cpp
    src/movegen.cpp
    src/perft.cpp
    src/zobrist.cpp
    src/eval.cpp
    src/tt.cpp
    src/search.cpp
)

add_library(shockfits_core ${SHOCKFITS_LIB_SOURCES})
target_include_directories(shockfits_core PUBLIC include)

find_package(Threads REQUIRED)
target_link_libraries(shockfits_core PUBLIC Threads::Threads)

# ---- Engine executable ------------------------------------------------------
add_executable(engine src/engine.cpp)
target_link_libraries(engine PRIVATE shockfits_core)

# Keep the binary at core/engine so the existing web/server.js keeps working
# during the transition (it spawns ../core/engine).
set_target_properties(engine PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})

# ---- Tests ------------------------------------------------------------------
add_subdirectory(tests)
