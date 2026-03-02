#include <iostream>
#include <string>
#include <vector>
#include <cstdlib>
#include <ctime>

int main(int argc, char* argv[]) {
    srand(time(nullptr));

    if (argc < 2) {
        std::cerr << "Usage: engine <moves_csv> [fen]" << std::endl;
        return 1;
    }

    std::string movesStr = argv[1];
    std::string fen = (argc >= 3) ? argv[2] : "";
    std::vector<std::string> moves;

    size_t start = 0;
    while (start < movesStr.size()) {
        size_t end = movesStr.find(',', start);
        if (end == std::string::npos) end = movesStr.size();
        if (end > start) {
            moves.push_back(movesStr.substr(start, end - start));
        }
        start = end + 1;
    }

    if (moves.empty()) {
        std::cerr << "No moves" << std::endl;
        return 1;
    }

    int index = rand() % moves.size();
    std::cout << "urmom" << std::endl;

    return 0;
}
