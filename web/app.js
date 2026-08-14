// ShockFits Play page: White and Black can each be a Human or any bot.
// Shows per-move thinking time; supports bot-vs-bot with pause/resume.

let game = new Chess();
let board = null;
let history = [];      // chess.js move objects
let times = [];        // think time (ms) per ply, parallel to history
let players = { w: 'human', b: 'human' };
let thinking = false;
let paused = false;
let started = false;

function pieceTheme(piece) { return 'img/wikipedia/' + piece + '.png'; }

function initBoard() {
    board = Chessboard('board', {
        pieceTheme: pieceTheme,
        draggable: true,
        position: 'start',
        onDragStart, onDrop, onSnapEnd,
    });
    updateUI();
}

async function loadBots() {
    let bots = [], stockfish = [];
    try {
        const data = await (await fetch('/api/bots')).json();
        bots = data.bots || []; stockfish = data.stockfish || [];
    } catch (e) { console.error('could not load bots', e); }

    for (const which of ['white-player', 'black-player']) {
        const sel = document.getElementById(which);
        sel.innerHTML = '';
        const human = document.createElement('option');
        human.value = 'human'; human.textContent = 'Human';
        sel.appendChild(human);
        const grp = (label, list) => {
            const og = document.createElement('optgroup');
            og.label = label;
            list.forEach(b => {
                const o = document.createElement('option');
                o.value = b.name; o.textContent = b.name;
                og.appendChild(o);
            });
            sel.appendChild(og);
        };
        grp('ShockFits bots', bots);
        grp('Stockfish', stockfish);
    }
    // Default: Human (White) vs first ShockFits bot (Black).
    if (bots[0]) document.getElementById('black-player').value = bots[0].name;
}

function isBot(color) { return players[color] !== 'human'; }
function turnColor() { return game.turn(); }  // 'w' | 'b'

function startGame() {
    players.w = document.getElementById('white-player').value;
    players.b = document.getElementById('black-player').value;
    started = true;
    paused = false;

    // Show pause control only for bot-vs-bot.
    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.classList.toggle('hidden', !(isBot('w') && isBot('b')));
    pauseBtn.textContent = 'Pause';

    resetGame(true);
    scheduleTurn();
}

function resetGame(keepStarted) {
    game.reset();
    board.start();
    history = [];
    times = [];
    thinking = false;
    if (!keepStarted) started = false;
    updateUI();
}

function onDragStart(source, piece) {
    if (!started || thinking || game.game_over()) return false;
    const t = turnColor();
    if (isBot(t)) return false;                       // bot's turn, no dragging
    if ((t === 'w' && piece.search(/^b/) !== -1) ||
        (t === 'b' && piece.search(/^w/) !== -1)) return false;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    history.push(move);
    times.push(null);  // human move: no engine time
    updateUI();
    setTimeout(scheduleTurn, 100);
}

function onSnapEnd() { board.position(game.fen()); }

function scheduleTurn() {
    if (!started || game.game_over()) { updateStatus(); return; }
    const t = turnColor();
    if (isBot(t) && !paused) {
        setTimeout(makeBotMove, 250);
    } else {
        updateStatus();  // waiting for human (or paused)
    }
}

async function makeBotMove() {
    if (!started || game.game_over() || paused) return;
    const t = turnColor();
    const bot = players[t];
    thinking = true;
    updateStatus();

    try {
        const res = await fetch('/api/bot-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: game.fen(), bot }),
        });
        const data = await res.json();
        thinking = false;

        if (!data.move) { updateStatus(); return; }
        const move = game.move({
            from: data.move.substring(0, 2),
            to: data.move.substring(2, 4),
            promotion: data.move.substring(4, 5) || 'q',
        });
        if (move) {
            history.push(move);
            times.push(typeof data.ms === 'number' ? data.ms : null);
            board.position(game.fen());
            updateUI();
            setTimeout(scheduleTurn, 200);  // continue (bot-vs-bot loops here)
        }
    } catch (e) {
        thinking = false;
        console.error(e);
        updateStatus();
    }
}

function fmtMs(ms) {
    if (ms == null) return '';
    return ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : ms + 'ms';
}

function updateUI() {
    updateStatus();
    updateMovesList();
    document.getElementById('move-count').textContent = history.length;
}

function updateStatus() {
    const t = turnColor();
    const who = (c) => isBot(c) ? players[c] : 'Human';
    let status;

    if (!started) {
        status = 'Pick players and press Start.';
    } else if (game.in_checkmate()) {
        const winner = t === 'w' ? 'Black' : 'White';
        status = `Checkmate — ${winner} (${who(t === 'w' ? 'b' : 'w')}) wins`;
    } else if (game.in_stalemate()) {
        status = 'Stalemate — draw';
    } else if (game.in_draw()) {
        status = 'Draw';
    } else if (thinking) {
        const lastLbl = who(t);
        status = `${lastLbl} (${t === 'w' ? 'White' : 'Black'}) is thinking...`;
    } else {
        // Show last move's think time if available.
        const lastMs = times.length ? times[times.length - 1] : null;
        const tail = lastMs != null ? `  (last move: ${fmtMs(lastMs)})` : '';
        status = `${who(t)} to move (${t === 'w' ? 'White' : 'Black'})${tail}`;
        if (paused) status = 'Paused. ' + status;
    }
    document.getElementById('status').textContent = status;
}

function updateMovesList() {
    const list = document.getElementById('moves-list');
    list.innerHTML = '';
    for (let i = 0; i < history.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const w = history[i], b = history[i + 1];
        const wt = fmtMs(times[i]), bt = fmtMs(times[i + 1]);
        const div = document.createElement('div');
        div.className = 'move-entry';
        div.innerHTML =
            `<span class="move-number">${moveNum}.</span>` +
            `${w.san}${wt ? ` <span class="mt">${wt}</span>` : ''}` +
            (b ? `  ${b.san}${bt ? ` <span class="mt">${bt}</span>` : ''}` : '');
        list.appendChild(div);
    }
    list.scrollTop = list.scrollHeight;
}

function undoMove() {
    if (history.length === 0) return;
    game.undo(); history.pop(); times.pop();
    // If a human is playing against a bot, undo the bot's reply too so it's
    // the human's move again.
    const t = turnColor();
    if (isBot(t) && history.length > 0) {
        game.undo(); history.pop(); times.pop();
    }
    board.position(game.fen());
    updateUI();
}

function togglePause() {
    paused = !paused;
    document.getElementById('pause-btn').textContent = paused ? 'Resume' : 'Pause';
    if (!paused) scheduleTurn();
    else updateStatus();
}

window.addEventListener('DOMContentLoaded', () => {
    initBoard();
    loadBots();
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('reset-btn').addEventListener('click', () => resetGame(false));
    document.getElementById('undo-btn').addEventListener('click', undoMove);
    document.getElementById('flip-btn').addEventListener('click', () => board.flip());
    document.getElementById('pause-btn').addEventListener('click', togglePause);
});
