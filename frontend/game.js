class ChessGame {
    constructor() {
        this.game = new Chess();
        this.moveHistory = [];
        this.gameMode = 'hvh';
        this.board = null;
        this.isComputerThinking = false;
        this.initializeBoard();
        this.attachEventListeners();
        this.updateUI();
    }

    initializeBoard() {
        const config = {
            draggable: true,
            position: 'start',
            onDragStart: this.onDragStart.bind(this),
            onDrop: this.onDrop.bind(this),
            onSnapEnd: this.onSnapEnd.bind(this),
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        };

        this.board = ChessBoard('board', config);
    }

    attachEventListeners() {
        document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());
        document.getElementById('undo-btn').addEventListener('click', () => this.undoMove());
        document.getElementById('flip-btn').addEventListener('click', () => this.flipBoard());
        document.getElementById('hvh-btn').addEventListener('click', () => this.setGameMode('hvh'));
        document.getElementById('hvc-btn').addEventListener('click', () => this.setGameMode('hvc'));
        document.getElementById('cvc-btn').addEventListener('click', () => this.setGameMode('cvc'));
    }

    onDragStart(source, piece, position, orientation) {
        if (this.isComputerThinking) return false;
        if (this.game.isGameOver()) return false;

        const canDrag = {
            'hvh': true,
            'hvc': this.game.turn() === 'w',
            'cvc': false
        };

        if (!canDrag[this.gameMode]) return false;

        const moves = this.game.moves({ square: source, verbose: true });
        return moves.length > 0;
    }

    onDrop(source, target, piece, newPos, oldPos, orientation) {
        const move = this.game.move({
            from: source,
            to: target,
            promotion: 'q'
        });

        if (move === null) return 'snapback';

        this.moveHistory.push(move);
        this.updateUI();
        this.handleGameFlow();

        return;
    }

    onSnapEnd() {
        this.board.position(this.game.fen());
    }

    async handleGameFlow() {
        if (this.game.isGameOver()) {
            this.updateStatus(this.getGameOverMessage());
            return;
        }

        if (this.gameMode === 'hvh') {
            this.updateStatus(this.getStatusText());
            return;
        }

        if (this.gameMode === 'hvc' && this.game.turn() === 'b') {
            await this.makeComputerMove();
        } else if (this.gameMode === 'cvc') {
            await this.makeComputerMove();
            if (!this.game.isGameOver()) {
                setTimeout(() => this.handleGameFlow(), 800);
            }
        }

        this.updateStatus(this.getStatusText());
    }

    async makeComputerMove() {
        this.isComputerThinking = true;
        this.updateStatus('Computer is thinking...');

        try {
            const moves = this.game.moves();

            if (moves.length === 0) {
                this.isComputerThinking = false;
                return;
            }

            const response = await fetch('/api/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moves })
            });

            const data = await response.json();

            if (data.move && data.move.length === 4) {
                const source = data.move.substring(0, 2);
                const target = data.move.substring(2, 4);

                const move = this.game.move({
                    from: source,
                    to: target,
                    promotion: 'q'
                });

                if (move) {
                    this.moveHistory.push(move);
                    this.board.position(this.game.fen());
                    this.updateUI();

                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } catch (error) {
            console.error('Computer move error:', error);
        } finally {
            this.isComputerThinking = false;
        }
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;

        this.game.undo();
        this.moveHistory.pop();

        if (this.gameMode === 'hvc' && this.moveHistory.length > 0) {
            this.game.undo();
            this.moveHistory.pop();
        }

        this.board.position(this.game.fen());
        this.updateUI();
    }

    flipBoard() {
        this.board.flip();
    }

    resetGame() {
        this.game.reset();
        this.moveHistory = [];
        this.board.start();
        this.updateUI();

        if (this.gameMode === 'cvc') {
            this.isComputerThinking = true;
            setTimeout(() => {
                this.handleGameFlow();
            }, 500);
        }
    }

    setGameMode(mode) {
        this.gameMode = mode;
        this.resetGame();
        this.updateGameModeButtons();
    }

    updateUI() {
        this.updateStatus(this.getStatusText());
        this.updatePlayerNames();
        this.updateMovesList();
        this.updateMoveCount();
    }

    getStatusText() {
        if (this.isComputerThinking) {
            return 'Computer is thinking...';
        }

        if (this.game.isCheck()) {
            return `${this.game.turn() === 'w' ? 'White' : 'Black'} is in check`;
        }

        return `${this.game.turn() === 'w' ? 'White' : 'Black'}'s turn`;
    }

    getGameOverMessage() {
        if (this.game.isCheckmate()) {
            return this.game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
        }
        if (this.game.isStalemate()) {
            return 'Stalemate - Draw';
        }
        if (this.game.isThreefoldRepetition()) {
            return 'Draw by threefold repetition';
        }
        if (this.game.isInsufficientMaterial()) {
            return 'Draw by insufficient material';
        }
        if (this.game.isDraw()) {
            return 'Draw';
        }
        return 'Game Over';
    }

    updateStatus(text) {
        document.getElementById('status-text').textContent = text;
    }

    updatePlayerNames() {
        const modeNames = {
            'hvh': { white: 'Player 1', black: 'Player 2' },
            'hvc': { white: 'Human', black: 'Computer' },
            'cvc': { white: 'Computer 1', black: 'Computer 2' }
        };

        const names = modeNames[this.gameMode];
        document.getElementById('white-player-name').textContent = names.white;
        document.getElementById('black-player-name').textContent = names.black;
    }

    updateMovesList() {
        const movesList = document.getElementById('moves-list');
        movesList.innerHTML = '';

        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const num = (i / 2) + 1;
            const whiteSan = this.moveHistory[i].san;
            const blackSan = this.moveHistory[i + 1] ? this.moveHistory[i + 1].san : '';

            const entry = document.createElement('div');
            entry.innerHTML = `<span class="move-number">${num}.</span>`;

            const whiteEl = document.createElement('span');
            whiteEl.className = 'move-entry white';
            whiteEl.textContent = whiteSan;
            entry.appendChild(whiteEl);

            if (blackSan) {
                const blackEl = document.createElement('span');
                blackEl.className = 'move-entry black';
                blackEl.textContent = blackSan;
                entry.appendChild(blackEl);
            }

            movesList.appendChild(entry);
        }

        movesList.scrollTop = movesList.scrollHeight;
    }

    updateMoveCount() {
        document.getElementById('move-count').textContent = this.moveHistory.length;
    }

    updateGameModeButtons() {
        document.getElementById('hvh-btn').classList.toggle('active', this.gameMode === 'hvh');
        document.getElementById('hvc-btn').classList.toggle('active', this.gameMode === 'hvc');
        document.getElementById('cvc-btn').classList.toggle('active', this.gameMode === 'cvc');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
