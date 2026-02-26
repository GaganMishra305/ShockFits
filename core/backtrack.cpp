#include <iostream>
#include <vector>
#include <string>

// Simple backtracking algorithm for generating valid chess moves
// Board representation: 8x8 array where 0 = empty, positive = white piece, negative = black piece

class SimpleChessBacktrack {
private:
    std::vector<std::vector<int>> board;
    std::vector<std::string> validMoves;
    bool isWhiteTurn;

public:
    SimpleChessBacktrack() : isWhiteTurn(true) {
        initializeBoard();
    }

    void initializeBoard() {
        // Initialize empty board
        board.assign(8, std::vector<int>(8, 0));
        
        // Set up starting position (simplified)
        // 1 = pawn, 2 = knight, 3 = bishop, 4 = rook, 5 = queen, 6 = king
        for (int i = 0; i < 8; i++) {
            board[1][i] = 1;   // white pawns
            board[6][i] = -1;  // black pawns
        }
    }

    // Check if position is within board bounds
    bool isValid(int row, int col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    // Backtracking function for pawn moves
    void generatePawnMoves(int row, int col) {
        int direction = isWhiteTurn ? -1 : 1;  // white moves up (-1), black moves down (+1)
        int startRow = isWhiteTurn ? 6 : 1;
        
        // Move forward one square
        int newRow = row + direction;
        if (isValid(newRow, col) && board[newRow][col] == 0) {
            validMoves.push_back(coordsToNotation(row, col) + "-" + coordsToNotation(newRow, col));
            
            // Move forward two squares from starting position
            if (row == startRow) {
                int newRow2 = row + 2 * direction;
                if (isValid(newRow2, col) && board[newRow2][col] == 0) {
                    validMoves.push_back(coordsToNotation(row, col) + "-" + coordsToNotation(newRow2, col));
                }
            }
        }
        
        // Diagonal captures
        for (int dcol : {-1, 1}) {
            int captureRow = row + direction;
            int captureCol = col + dcol;
            if (isValid(captureRow, captureCol)) {
                int target = board[captureRow][captureCol];
                // Check if there's an opponent piece
                if ((isWhiteTurn && target < 0) || (!isWhiteTurn && target > 0)) {
                    validMoves.push_back(coordsToNotation(row, col) + "x" + coordsToNotation(captureRow, captureCol));
                }
            }
        }
    }

    // Backtracking function for knight moves
    void generateKnightMoves(int row, int col) {
        int moves[][2] = {{-2,-1}, {-2,1}, {-1,-2}, {-1,2}, {1,-2}, {1,2}, {2,-1}, {2,1}};
        
        for (auto& move : moves) {
            int newRow = row + move[0];
            int newCol = col + move[1];
            
            if (isValid(newRow, newCol)) {
                int target = board[newRow][newCol];
                // Can move if empty or capture opponent piece
                if (target == 0 || (isWhiteTurn && target < 0) || (!isWhiteTurn && target > 0)) {
                    std::string notation = coordsToNotation(row, col) + "-" + coordsToNotation(newRow, newCol);
                    validMoves.push_back(notation);
                }
            }
        }
    }

    // Main backtracking function: generate all valid moves for current player
    void generateAllMoves() {
        validMoves.clear();
        
        // Iterate through board
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                int piece = board[row][col];
                
                // Skip empty squares and opponent pieces
                if (piece == 0) continue;
                if (isWhiteTurn && piece < 0) continue;
                if (!isWhiteTurn && piece > 0) continue;
                
                int absPiece = std::abs(piece);
                
                // Generate moves based on piece type (backtrack for each piece)
                switch (absPiece) {
                    case 1:  // Pawn
                        generatePawnMoves(row, col);
                        break;
                    case 2:  // Knight
                        generateKnightMoves(row, col);
                        break;
                    // Add more piece types as needed
                }
            }
        }
    }

    // Convert board coordinates to chess notation
    std::string coordsToNotation(int row, int col) {
        char file = 'a' + col;
        char rank = '8' - row;
        return std::string(1, file) + rank;
    }

    // Display all valid moves
    void printMoves() {
        std::cout << "Valid moves for " << (isWhiteTurn ? "White" : "Black") << ":\n";
        for (const auto& move : validMoves) {
            std::cout << move << "\n";
        }
        std::cout << "Total: " << validMoves.size() << " moves\n";
    }

    // Get random valid move
    std::string getRandomMove() {
        if (validMoves.empty()) return "";
        return validMoves[rand() % validMoves.size()];
    }

    void togglePlayer() {
        isWhiteTurn = !isWhiteTurn;
    }
};

// Example usage
int main() {
    srand(time(nullptr));
    
    SimpleChessBacktrack engine;
    engine.generateAllMoves();
    engine.printMoves();
    
    std::cout << "\nRandom move: " << engine.getRandomMove() << std::endl;
    
    return 0;
}
