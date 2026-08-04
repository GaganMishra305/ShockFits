# ---- ShockFits tests --------------------------------------------------------

add_executable(shockfits_tests
    test_main.cpp
    sanity_test.cpp
    perft_test.cpp
)
target_link_libraries(shockfits_tests PRIVATE shockfits_core)

add_test(NAME shockfits_tests COMMAND shockfits_tests)
