#include <iostream>
#include <string>
#include <vector>
#include <cstdlib>
#include <ctime>

int main(int argc, char* argv[]) {
    srand(time(nullptr));

    if (argc < 2) {
        std::cerr << "Usage: engine <moves>" << std::endl;
        return 1;
    }

    std::string movesStr = argv[1];
    std::vector<std::string> moves;

    for (size_t i = 0; i + 4 <= movesStr.length(); i += 4) {
        moves.push_back(movesStr.substr(i, 4));
    }

    if (moves.empty()) {
        std::cerr << "No moves" << std::endl;
        return 1;
    }

    int index = rand() % moves.size();
    std::cout << moves[index] << std::endl;

    return 0;
}
