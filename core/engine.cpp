#include <iostream>
#include <string>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <sstream>

std::vector<std::string> currentMoves;
std::string currentFen;

void setPosition(const std::string& movesCsv, const std::string& fen) {
    currentMoves.clear();
    currentFen = fen;

    std::stringstream ss(movesCsv);
    std::string move;
    while (std::getline(ss, move, ',')) {
        if (!move.empty())
            currentMoves.push_back(move);
    }

    std::cerr << "[ENGINE] Position set. Moves = "
              << currentMoves.size() << std::endl;
}

std::string computeMove() {
    if (currentMoves.empty()) return "";

    int idx = rand() % currentMoves.size();
    return currentMoves[idx];
}

int main() {
    srand(time(nullptr));

    std::string line;

    std::cerr << "[ENGINE] Engine started" << std::endl;

    while (std::getline(std::cin, line)) {
        if (line == "quit") {
            std::cerr << "[ENGINE] Quitting" << std::endl;
            break;
        }

        if (line.rfind("position", 0) == 0) {
            // position <moves_csv> <fen>
            std::stringstream ss(line);
            std::string cmd, movesCsv, fen;

            ss >> cmd;
            ss >> movesCsv;
            std::getline(ss, fen);
            if (!fen.empty() && fen[0] == ' ')
                fen.erase(0, 1);

            setPosition(movesCsv, fen);
            continue;
        }

        if (line == "go") {
            std::string bestMove = computeMove();
            std::cout << bestMove << std::endl;
            std::cout.flush();
            continue;
        }

        std::cerr << "[ENGINE] Unknown command: " << line << std::endl;
    }

    return 0;
}
