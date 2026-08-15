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

let evtSource = null;
let liveFollow = false;   // auto-jump to the newest move while a game streams

async function runGame() {
    stopAuto();
    if (evtSource) { evtSource.close(); evtSource = null; }

    const white = document.getElementById('white-select').value;
    const black = document.getElementById('black-select').value;
    const opening = parseInt(document.getElementById('opening-select').value, 10);
    const btn = document.getElementById('run-btn');

    btn.disabled = true;
    document.getElementById('result-banner').classList.add('hidden');
    game = { white, black, result: null, termination: null,
             moves_san: [], moves_uci: [], fens: [], times: [] };
    ply = 0;
    liveFollow = true;
    renderMatchup();
    renderMoves();
    board.start();
    document.getElementById('ply-indicator').textContent = '0 / 0';
    setStatus(`Live: ${white} vs ${black}... (watching moves as they happen)`);

    const url = `/api/arena/stream?white=${encodeURIComponent(white)}` +
                `&black=${encodeURIComponent(black)}&opening=${opening}`;
    evtSource = new EventSource(url);

    evtSource.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch (_) { return; }

        if (msg.type === 'start') {
            game.white = msg.white; game.black = msg.black;
            renderMatchup();
        } else if (msg.type === 'move') {
            game.moves_san.push(msg.san);
            game.moves_uci.push(msg.uci);
            game.fens.push(msg.fen);
            game.times.push(typeof msg.ms === 'number' ? msg.ms : null);
            renderMoves();
            if (liveFollow) goToPly(game.fens.length);  // auto-follow newest
            else document.getElementById('ply-indicator').textContent =
                `${ply} / ${game.fens.length}`;
        } else if (msg.type === 'end') {
            game.result = msg.result;
            game.termination = msg.termination;
            renderBanner();
            setStatus(`Done: ${msg.result} (${msg.termination}, ${msg.plies} plies). Scrub the controls to replay.`);
        }
    };

    evtSource.addEventListener('done', () => {
        if (evtSource) { evtSource.close(); evtSource = null; }
        btn.disabled = false;
    });
    evtSource.onerror = () => {
        if (evtSource) { evtSource.close(); evtSource = null; }
        btn.disabled = false;
        if (!game.result) setStatus('Stream ended unexpectedly.', true);
    };
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
    const t = game.times ? game.times[idx] : null;
    const tt = t != null ? ` <span class="mt">${fmtMs(t)}</span>` : '';
    s.innerHTML = game.moves_san[idx] + tt;
    s.onclick = () => { liveFollow = false; stopAuto(); goToPly(idx + 1); };
    return s;
}

function fmtMs(ms) {
    if (ms == null) return '';
    return ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : ms + 'ms';
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
    document.getElementById('first-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(0); };
    document.getElementById('prev-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(ply - 1); };
    document.getElementById('next-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(ply + 1); };
    document.getElementById('last-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(game ? game.fens.length : 0); };
    document.getElementById('play-btn').onclick = () => { liveFollow = false; toggleAuto(); };
});
