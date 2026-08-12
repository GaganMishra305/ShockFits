// ShockFits Arena: run a game between two fighters and replay it move-by-move.

const OPENINGS = [
    'Start position', 'Open Game (1.e4 e5)', 'Sicilian (1.e4 c5)',
    'French (1.e4 e6)', 'Caro-Kann (1.e4 c6)', "Queen's Gambit",
    "King's Indian setup", 'Reti', 'English (1.c4 e5)', 'Ruy Lopez',
];

let board = null;
let game = null;        // { white, black, result, termination, moves_san, fens }
let ply = 0;            // 0 = start position; k = after k half-moves
let autoTimer = null;

function pieceTheme(piece) { return 'img/wikipedia/' + piece + '.png'; }

function initBoard() {
    board = Chessboard('board', {
        pieceTheme: pieceTheme,
        position: 'start',
        draggable: false,
    });
}

async function loadFighters() {
    const res = await fetch('/api/bots');
    const data = await res.json();
    const white = document.getElementById('white-select');
    const black = document.getElementById('black-select');

    const opt = (name, label) => {
        const o = document.createElement('option');
        o.value = name; o.textContent = label; return o;
    };

    const groups = [
        ['ShockFits bots', data.bots],
        ['Stockfish', data.stockfish],
    ];
    for (const sel of [white, black]) {
        for (const [label, list] of groups) {
            const og = document.createElement('optgroup');
            og.label = label;
            list.forEach((b) => og.appendChild(opt(b.name, b.name)));
            sel.appendChild(og);
        }
    }
    // Sensible defaults: a ShockFits bot vs a Stockfish.
    if (data.bots[0]) white.value = data.bots[0].name;
    if (data.stockfish[0]) black.value = data.stockfish[0].name;

    const os = document.getElementById('opening-select');
    OPENINGS.forEach((label, i) => os.appendChild(opt(String(i), label)));
}

function setStatus(msg, isError) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
}

async function runGame() {
    stopAuto();
    const white = document.getElementById('white-select').value;
    const black = document.getElementById('black-select').value;
    const opening = parseInt(document.getElementById('opening-select').value, 10);
    const btn = document.getElementById('run-btn');

    btn.disabled = true;
    setStatus(`Running ${white} vs ${black}... (engines are thinking)`);
    document.getElementById('result-banner').classList.add('hidden');

    try {
        const res = await fetch('/api/arena/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ white, black, opening }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'game failed');

        game = data;
        ply = 0;
        renderMatchup();
        renderMoves();
        renderBanner();
        goToPly(0);
        setStatus(`Done: ${data.result} (${data.termination}, ${data.plies} plies). Use the controls to replay.`);
    } catch (e) {
        setStatus('Error: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

function renderMatchup() {
    document.getElementById('matchup').innerHTML =
        `<span class="w">&#9817; ${game.white}</span> &nbsp;vs&nbsp; ` +
        `<span class="b">&#9823; ${game.black}</span>`;
}

function renderBanner() {
    const el = document.getElementById('result-banner');
    el.classList.remove('hidden', 'banner-w', 'banner-l', 'banner-d');
    let text, cls;
    if (game.result === '1/2-1/2') {
        text = `Draw (${game.termination})`; cls = 'banner-d';
    } else {
        const winner = game.result === '1-0' ? game.white : game.black;
        text = `${game.result} - ${winner} wins by ${game.termination}`;
        cls = 'banner-w';
    }
    el.textContent = text;
    el.classList.add(cls);
}

function renderMoves() {
    const list = document.getElementById('moves-list');
    list.innerHTML = '';
    const m = game.moves_san;
    for (let i = 0; i < m.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'move-pair';
        const num = Math.floor(i / 2) + 1;
        row.innerHTML = `<span class="num">${num}.</span>`;
        row.appendChild(moveSpan(i));
        if (m[i + 1] !== undefined) row.appendChild(moveSpan(i + 1));
        list.appendChild(row);
    }
}

function moveSpan(idx) {
    const s = document.createElement('span');
    s.className = 'm';
    s.dataset.ply = idx + 1;  // this move produces position at ply idx+1
    s.textContent = game.moves_san[idx];
    s.onclick = () => goToPly(idx + 1);
    return s;
}

function goToPly(k) {
    if (!game) return;
    ply = Math.max(0, Math.min(k, game.fens.length));
    const fen = ply === 0 ? 'start' : game.fens[ply - 1];
    board.position(fen);

    document.getElementById('ply-indicator').textContent =
        `${ply} / ${game.fens.length}`;

    document.querySelectorAll('.move-pair .m').forEach((el) => {
        el.classList.toggle('current', parseInt(el.dataset.ply, 10) === ply);
    });
    const cur = document.querySelector('.move-pair .m.current');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
}

function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    document.getElementById('play-btn').innerHTML = '&#9654; Play';
}

function toggleAuto() {
    if (!game) return;
    if (autoTimer) { stopAuto(); return; }
    if (ply >= game.fens.length) goToPly(0);
    document.getElementById('play-btn').innerHTML = '&#10073;&#10073; Pause';
    autoTimer = setInterval(() => {
        if (ply >= game.fens.length) { stopAuto(); return; }
        goToPly(ply + 1);
    }, 650);
}

window.addEventListener('DOMContentLoaded', () => {
    initBoard();
    loadFighters();
    document.getElementById('run-btn').onclick = runGame;
    document.getElementById('first-btn').onclick = () => { stopAuto(); goToPly(0); };
    document.getElementById('prev-btn').onclick = () => { stopAuto(); goToPly(ply - 1); };
    document.getElementById('next-btn').onclick = () => { stopAuto(); goToPly(ply + 1); };
    document.getElementById('last-btn').onclick = () => { stopAuto(); goToPly(game ? game.fens.length : 0); };
    document.getElementById('play-btn').onclick = toggleAuto;
});
