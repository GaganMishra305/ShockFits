#include <iostream>
#include <string>
#include <vector>
#include <cstdlib>
#include <ctime>

struct Move {
    std::string from;
    std::string to;
};

std::vector<std::string> parseMovesString(const std::string& movesStr) {
    std::vector<std::string> moves;
    std::string move;
    for (size_t i = 0; i < movesStr.length(); i += 4) {
        if (i + 4 <= movesStr.length()) {
            move = movesStr.substr(i, 4);
            moves.push_back(move);
        }
    }
    return moves;
}

int main(int argc, char* argv[]) {
    srand(static_cast<unsigned>(time(nullptr)));

    if (argc < 2) {
        std::cerr << "Usage: engine <moves_string>" << std::endl;
        return 1;
    }

    std::string movesStr = argv[1];
    std::vector<std::string> availableMoves = parseMovesString(movesStr);

    if (availableMoves.empty()) {
        std::cerr << "No valid moves available" << std::endl;
        return 1;
    }

    int randomIndex = rand() % availableMoves.size();
    std::cout << availableMoves[randomIndex] << std::endl;

    return 0;
}
