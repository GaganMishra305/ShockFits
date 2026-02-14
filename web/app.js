let game = new Chess();
let board = null;
let mode = 'hvh';
let thinking = false;
let history = [];

function pieceTheme (piece) {
  if (piece.search(/w/) !== -1) {
    return 'img/wikipedia/' + piece + '.png'
  }
  return 'img/wikipedia/' + piece + '.png'
}

function initBoard() {
    const config = {
        pieceTheme: pieceTheme,
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };

    board = Chessboard('board', config);
    updateUI();
}

function onDragStart(source, piece) {
    if (thinking || game.game_over()) return false;
    if (mode === 'cvc') return false;
    if (mode === 'hvc' && game.turn() === 'b') return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    history.push(move);
    updateUI();
    
    setTimeout(() => handleTurn(), 100);
}

function onSnapEnd() {
    board.position(game.fen());
}

async function handleTurn() {
    if (game.game_over()) {
        updateStatus();
        return;
    }

    if (mode === 'hvh') return;

    if (mode === 'hvc' && game.turn() === 'b') {
        await makeComputerMove();
    } else if (mode === 'cvc') {
        await makeComputerMove();
        if (!game.game_over()) {
            setTimeout(() => handleTurn(), 800);
        }
    }
}

async function makeComputerMove() {
    thinking = true;
    updateStatus();

    const verboseMoves = game.moves({ verbose: true });
    const movesUci = verboseMoves.map(m => `${m.from}${m.to}${m.promotion ? m.promotion : ''}`);
    if (movesUci.length === 0) {
        thinking = false;
        updateStatus();
        return;
    }

    try {
        const res = await fetch('/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fen: game.fen(),
                moves: movesUci
            })
        });

        const data = await res.json();
        let chosen = data.move;

        if (!chosen || !/^([a-h][1-8]){2}[qrbn]?$/i.test(chosen)) {
            // Fallback: pick a random legal move locally
            chosen = movesUci[Math.floor(Math.random() * movesUci.length)];
        }

        const move = game.move({
            from: chosen.substring(0, 2),
            to: chosen.substring(2, 4),
            promotion: chosen.substring(4, 5) || 'q'
        });

        if (move) {
            history.push(move);
            board.position(game.fen());
            updateUI();
            await new Promise(r => setTimeout(r, 300));
        }
    } catch (error) {
        console.error('Error:', error);
    }

    thinking = false;
    updateStatus();
}

function updateUI() {
    updateStatus();
    updateMovesList();
    document.getElementById('move-count').textContent = history.length;
}

function updateStatus() {
    let status = '';

    if (thinking) {
        status = 'Computer thinking...';
    } else if (game.in_checkmate()) {
        status = (game.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate';
    } else if (game.in_draw()) {
        status = 'Draw';
    } else if (game.in_stalemate()) {
        status = 'Stalemate';
    } else if (game.in_check()) {
        status = (game.turn() === 'w' ? 'White' : 'Black') + ' is in check';
    } else {
        status = (game.turn() === 'w' ? 'White' : 'Black') + "'s turn";
    }

    document.getElementById('status').textContent = status;
}

function updateMovesList() {
    const list = document.getElementById('moves-list');
    list.innerHTML = '';

    for (let i = 0; i < history.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const white = history[i].san;
        const black = history[i + 1] ? history[i + 1].san : '';

        const div = document.createElement('div');
        div.className = 'move-entry';
        div.innerHTML = `<span class="move-number">${moveNum}.</span>${white}${black ? ' ' + black : ''}`;
        list.appendChild(div);
    }

    list.scrollTop = list.scrollHeight;
}

function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(newMode + '-btn').classList.add('active');
    resetGame();
}

function resetGame() {
    game.reset();
    board.start();
    history = [];
    updateUI();

    if (mode === 'cvc') {
        setTimeout(() => handleTurn(), 500);
    }
}

function undoMove() {
    if (history.length === 0) return;

    game.undo();
    history.pop();

    if (mode === 'hvc' && history.length > 0) {
        game.undo();
        history.pop();
    }

    board.position(game.fen());
    updateUI();
}

document.getElementById('hvh-btn').addEventListener('click', () => setMode('hvh'));
document.getElementById('hvc-btn').addEventListener('click', () => setMode('hvc'));
document.getElementById('cvc-btn').addEventListener('click', () => setMode('cvc'));
document.getElementById('reset-btn').addEventListener('click', resetGame);
document.getElementById('undo-btn').addEventListener('click', undoMove);
document.getElementById('flip-btn').addEventListener('click', () => board.flip());

window.addEventListener('DOMContentLoaded', initBoard);
