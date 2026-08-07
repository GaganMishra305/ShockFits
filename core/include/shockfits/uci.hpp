#pragma once

// UCI (Universal Chess Interface) protocol driver. Turns ShockFits into a
// pluggable engine that any UCI GUI (Cute Chess, Arena, BanksiaGUI) or
// tournament tool (cutechess-cli) can drive -- the prerequisite for the
// Bots Royale and Stockfish Gauntlet.
//
// Reference: http://wbec-ridderkerk.nl/html/UCIProtocol.html

#include <string>

#include "shockfits/board.hpp"
#include "shockfits/search.hpp"

namespace shockfits {

class Uci {
   public:
    Uci();

    // Blocking loop: reads UCI commands from stdin until "quit".
    void loop();

    // Handle a single command line (exposed for testing).
    // Returns false when the engine should quit.
    bool handle(const std::string& line);

   private:
    void cmd_uci();
    void cmd_isready();
    void cmd_newgame();
    void cmd_setoption(const std::string& args);
    void cmd_position(const std::string& args);
    void cmd_go(const std::string& args);

    // Parse a UCI move ("e2e4", "e7e8q") into a legal Move for the current
    // board, or kNullMove if it isn't legal.
    Move parse_move(const std::string& uci) const;

    Board board_;
    Searcher searcher_;
    std::size_t hash_mb_ = 64;
    int threads_ = 1;  // stored now; used in Phase 4 (Lazy SMP)
};

}  // namespace shockfits
