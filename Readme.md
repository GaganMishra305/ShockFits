# Chess Engine

A feature-rich chess game frontend with multiple game modes (Human vs Human, Human vs Computer, Computer vs Computer) powered by a C++ engine backend.

## Project Structure

```
ChessEngine/
├── core/
│   └── engine.cpp          # C++ chess engine (returns random moves)
├── frontend/
│   ├── index.html          # Main game interface
│   ├── styles.css          # Game styling
│   └── game.js             # Game logic and UI controller
├── server.js               # Node.js backend server
├── package.json            # Dependencies
└── Readme.md
```

## Features

- **Multiple Game Modes**: Human vs Human, Human vs Computer, Computer vs Computer
- **Full Chess Rules**: Castling, en passant, pawn promotion, checkmate, stalemate detection
- **Move History**: Displays all moves in algebraic notation
- **Board Controls**: Flip board, undo moves, reset game
- **Interactive UI**: Legal move highlighting, responsive design
- **Computer AI**: Random move selection (extendable to advanced algorithms)

## Setup

### Prerequisites

- Node.js 14+ 
- g++ compiler
- npm

### Installation

1. Install dependencies:
```bash
cd /path/to/ChessEngine
npm install
```

2. Build the C++ engine:
```bash
npm run build-engine
```

### Running

Start the server:
```bash
npm start
```

The game will be available at `http://localhost:3000`

## Game Modes

- **Human vs Human**: Two players take turns on the same board
- **Human vs Computer**: Human plays as White, computer plays as Black
- **Computer vs Computer**: Watch two computer players compete

## Controls

- **Drag pieces** to move
- **New Game** - Start a fresh game in the current mode
- **Undo** - Undo the last move(s)
- **Flip Board** - Rotate the board 180 degrees
- **Mode buttons** - Switch between game modes

## Engine

The C++ engine accepts a string of moves in UCI format and returns a random legal move. This serves as a placeholder for a more sophisticated evaluation algorithm.

To implement advanced engine features:
1. Modify `core/engine.cpp` with minimax, alpha-beta pruning, or other algorithms
2. Add position evaluation and board analysis
3. Implement opening books and endgame tables

## Technologies

- **Frontend**: HTML5, CSS3, JavaScript
- **Chess Logic**: chess.js library
- **Board UI**: chessboard.js library
- **Backend**: Node.js with Express
- **Engine**: C++

Following: dev.to/zeyu2001/build-a-simple-chess-ai-in-javascript-18eg