let game = new Chess();
let board = null;
let mode = 'hvh';
let thinking = false;
let history = [];
let cvcPaused = true;  // Start CvC as paused
let selectedBot = null;

async function loadBots() {
    try {
        const res = await fetch('/api/bots');
        const data = await res.json();
        const sel = document.getElementById('bot-select');
        const addGroup = (label, list) => {
            const og = document.createElement('optgroup');
            og.label = label;
            list.forEach(b => {
                const o = document.createElement('option');
                o.value = b.name; o.textContent = b.name;
                og.appendChild(o);
            });
            sel.appendChild(og);
        };
        addGroup('ShockFits bots', data.bots || []);
        addGroup('Stockfish', data.stockfish || []);
        selectedBot = sel.value;
        sel.addEventListener('change', () => { selectedBot = sel.value; });
    } catch (e) {
        console.error('could not load bots', e);
    }
}

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
    } else if (mode === 'cvc' && !cvcPaused) {
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
        const res = await fetch('/api/bot-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fen: game.fen(),
                bot: selectedBot
            })
        });

        const data = await res.json();
        let chosen = data.move;

        if (!chosen || !/^([a-h][1-8]){2}[qrbn]?$/i.test(chosen)) {
            console.warn('Invalid move from engine');
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
    
    // Show/hide CvC control button
    const cvcBtn = document.getElementById('cvc-control-btn');
    if (newMode === 'cvc') {
        cvcBtn.classList.remove('hidden');
        cvcPaused = true;
        cvcBtn.textContent = 'Start Game';
    } else {
        cvcBtn.classList.add('hidden');
    }
    
    resetGame();
}

function resetGame() {
    game.reset();
    board.start();
    history = [];
    cvcPaused = true;
    
    // Reset CvC button if in that mode
    const cvcBtn = document.getElementById('cvc-control-btn');
    if (mode === 'cvc') {
        cvcBtn.textContent = 'Start Game';
    }
    
    updateUI();
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

document.getElementById('cvc-control-btn').addEventListener('click', () => {
    cvcPaused = !cvcPaused;
    const btn = document.getElementById('cvc-control-btn');
    
    if (cvcPaused) {
        btn.textContent = 'Resume Game';
    } else {
        btn.textContent = 'Pause Game';
        handleTurn();
    }
    
    updateStatus();
});

window.addEventListener('DOMContentLoaded', () => { initBoard(); loadBots(); });
