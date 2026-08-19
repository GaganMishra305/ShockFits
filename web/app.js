// ShockFits unified arena.
//   - Human involved  -> interactive game (drag to move; bot replies via API).
//   - Bot vs bot       -> live stream (SSE) + scrubbable replay.

const OPENINGS = [
    'Start position', 'Open Game (1.e4 e5)', 'Sicilian (1.e4 c5)',
    'French (1.e4 e6)', 'Caro-Kann (1.e4 c6)', "Queen's Gambit",
    "King's Indian setup", 'Reti', 'English (1.c4 e5)', 'Ruy Lopez',
];

let board = null;
let chessLocal = new Chess();      // used in interactive mode
let players = { w: 'human', b: 'human' };
let mode = 'interactive';

// Shared view state
let moves = [];   // [{san, ms}]
let fens = [];    // position after each ply
let ply = 0;      // view cursor (interactive: always latest)

// Interactive state
let thinking = false;
let paused = false;
let started = false;

// Stream state
let evtSource = null;
let liveFollow = true;
let result = null, termination = null, mWhite = '', mBlack = '';

function pieceTheme(p) { return 'img/wikipedia/' + p + '.png'; }
function isBot(c) { return players[c] !== 'human'; }
function fmtMs(ms) {
    if (ms == null) return '';
    return ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : ms + 'ms';
}
const $ = (id) => document.getElementById(id);

// Optional per-side move-time override (ms). Empty/invalid -> 0 (use bot default).
function mtFor(color) {
    const el = $(color === 'w' ? 'white-mt' : 'black-mt');
    const v = parseInt(el && el.value, 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
}

function initBoard() {
    board = Chessboard('board', {
        pieceTheme, draggable: true, position: 'start',
        onDragStart, onDrop, onSnapEnd,
    });
}

async function loadBots() {
    let bots = [], stockfish = [];
    try {
        const d = await (await fetch('/api/bots')).json();
        bots = d.bots || []; stockfish = d.stockfish || [];
    } catch (e) { console.error(e); }

    for (const which of ['white-player', 'black-player']) {
        const sel = $(which); sel.innerHTML = '';
        const o = document.createElement('option');
        o.value = 'human'; o.textContent = 'Human (you)'; sel.appendChild(o);
        const grp = (label, list) => {
            const og = document.createElement('optgroup'); og.label = label;
            list.forEach(b => {
                const x = document.createElement('option');
                x.value = b.name; x.textContent = b.name; og.appendChild(x);
            });
            sel.appendChild(og);
        };
        grp('ShockFits bots', bots); grp('Stockfish', stockfish);
    }
    $('white-player').value = 'human';
    $('black-player').value = bots[0] ? bots[0].name : 'human';

    const os = $('opening-select');
    OPENINGS.forEach((label, i) => {
        const x = document.createElement('option');
        x.value = String(i); x.textContent = label; os.appendChild(x);
    });
}

async function loadElo() {
    try {
        const d = await (await fetch('/api/elo')).json();
        if (d && d.estimate_elo) {
            $('elo-value').textContent = `${d.estimate_elo} Elo`;
            $('elo-badge').title =
                `${d.bot} @ ${d.movetime_ms}ms/move, measured vs Stockfish (UCI_Elo)`;
        } else {
            $('elo-value').textContent = 'unrated';
        }
    } catch (e) { $('elo-value').textContent = 'unrated'; }
}

// ---- shared rendering -----------------------------------------------------
function setStatus(msg, opts = {}) {
    const el = $('status');
    el.textContent = msg;
    el.classList.toggle('thinking', !!opts.thinking);
}
function renderMatchup(w, b) {
    $('matchup').innerHTML =
        `<span class="name">${w}</span><span class="vs">vs</span><span class="name">${b}</span>`;
}
function renderBanner() {
    const el = $('result-banner');
    if (!result) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden', 'banner-w', 'banner-l', 'banner-d');
    if (result === '1/2-1/2') {
        el.textContent = `Draw — ${termination}`; el.classList.add('banner-d');
    } else {
        const winner = result === '1-0' ? mWhite : mBlack;
        el.textContent = `${result} — ${winner} wins by ${termination}`;
        el.classList.add('banner-w');
    }
}
function renderMoves(clickable) {
    const list = $('moves-list'); list.innerHTML = '';
    for (let i = 0; i < moves.length; i += 2) {
        const num = Math.floor(i / 2) + 1;
        const row = document.createElement('div'); row.className = 'move-entry';
        row.innerHTML = `<span class="move-number">${num}.</span>`;
        row.appendChild(cell(i, clickable));
        if (moves[i + 1]) row.appendChild(cell(i + 1, clickable));
        list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
}
function cell(i, clickable) {
    const s = document.createElement('span');
    s.className = clickable ? 'm' : 'san';
    s.dataset.ply = i + 1;
    const mt = fmtMs(moves[i].ms);
    s.innerHTML = `${moves[i].san}${mt ? ` <span class="mt">${mt}</span>` : ''}`;
    if (clickable) s.onclick = () => { liveFollow = false; stopAuto(); goToPly(i + 1); };
    return s;
}
function goToPly(k) {
    ply = Math.max(0, Math.min(k, fens.length));
    board.position(ply === 0 ? 'start' : fens[ply - 1]);
    $('ply-indicator').textContent = fens.length ? `${ply} / ${fens.length}` : '';
    document.querySelectorAll('.move-entry .m').forEach(el =>
        el.classList.toggle('current', parseInt(el.dataset.ply, 10) === ply));
    const cur = document.querySelector('.move-entry .m.current');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
}
function showControls(streamMode, human) {
    ['first-btn', 'prev-btn', 'play-btn', 'next-btn', 'last-btn'].forEach(
        id => $(id).classList.toggle('hidden', !streamMode));
    $('pause-btn').classList.add('hidden');  // not used in the unified flow
    $('undo-btn').classList.toggle('hidden', !human);
}

// ---- start dispatch -------------------------------------------------------
function resetView() {
    moves = []; fens = []; ply = 0; result = null; termination = null;
    renderMoves(false); board.start(); $('result-banner').classList.add('hidden');
    $('ply-indicator').textContent = '';
}

function startGame() {
    if (evtSource) { evtSource.close(); evtSource = null; }
    stopAuto();
    players.w = $('white-player').value;
    players.b = $('black-player').value;
    mWhite = players.w; mBlack = players.b;
    resetView();
    renderMatchup(mWhite, mBlack);

    const bothBots = isBot('w') && isBot('b');
    mode = bothBots ? 'stream' : 'interactive';
    if (bothBots) startStream();
    else startInteractive();
}

// ---- interactive (human involved) -----------------------------------------
function startInteractive() {
    showControls(false, true);
    chessLocal.reset(); board.start();
    started = true; paused = false; thinking = false;
    setStatus('Game on. ' + turnLabel() + ' to move.');
    board.orientation(isBot('w') && !isBot('b') ? 'black' : 'white');
    scheduleInteractiveTurn();
}
function turnLabel() {
    const t = chessLocal.turn();
    const who = isBot(t) ? players[t] : 'You';
    return `${who} (${t === 'w' ? 'White' : 'Black'})`;
}
function onDragStart(src, piece) {
    if (mode !== 'interactive' || !started || thinking || chessLocal.game_over())
        return false;
    const t = chessLocal.turn();
    if (isBot(t)) return false;
    if ((t === 'w' && piece.search(/^b/) !== -1) ||
        (t === 'b' && piece.search(/^w/) !== -1)) return false;
}
function onDrop(src, tgt) {
    const mv = chessLocal.move({ from: src, to: tgt, promotion: 'q' });
    if (mv === null) return 'snapback';
    pushLocal(mv, null);
    setTimeout(scheduleInteractiveTurn, 80);
}
function onSnapEnd() { if (mode === 'interactive') board.position(chessLocal.fen()); }
function pushLocal(mv, ms) {
    moves.push({ san: mv.san, ms }); fens.push(chessLocal.fen());
    renderMoves(false); ply = fens.length; goToPly(ply);
    $('ply-indicator').textContent = '';
}
function scheduleInteractiveTurn() {
    if (!started || chessLocal.game_over()) { finishInteractive(); return; }
    const t = chessLocal.turn();
    if (isBot(t) && !paused) setTimeout(botMove, 200);
    else setStatus(turnLabel() + ' to move.' + lastTimeSuffix());
}
function lastTimeSuffix() {
    const last = moves.length ? moves[moves.length - 1].ms : null;
    return last != null ? `  (last: ${fmtMs(last)})` : '';
}
async function botMove() {
    if (!started || chessLocal.game_over() || paused) return;
    const t = chessLocal.turn();
    thinking = true;
    setStatus(`${players[t]} (${t === 'w' ? 'White' : 'Black'}) is thinking...`,
              { thinking: true });
    try {
        const d = await (await fetch('/api/bot-move', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: chessLocal.fen(), bot: players[t],
                                   movetime: mtFor(t) }),
        })).json();
        thinking = false;
        if (!d.move) { finishInteractive(); return; }
        const mv = chessLocal.move({
            from: d.move.slice(0, 2), to: d.move.slice(2, 4),
            promotion: d.move.slice(4, 5) || 'q',
        });
        if (mv) { pushLocal(mv, d.ms); setTimeout(scheduleInteractiveTurn, 150); }
    } catch (e) { thinking = false; setStatus('Error: ' + e.message); }
}
function finishInteractive() {
    if (chessLocal.in_checkmate()) {
        const t = chessLocal.turn();
        result = t === 'w' ? '0-1' : '1-0'; termination = 'checkmate';
    } else if (chessLocal.in_stalemate()) { result = '1/2-1/2'; termination = 'stalemate'; }
    else if (chessLocal.in_draw()) { result = '1/2-1/2'; termination = 'draw'; }
    if (result) { renderBanner(); setStatus('Game over.'); }
    else setStatus(turnLabel() + ' to move.' + lastTimeSuffix());
}
function undoMove() {
    if (mode !== 'interactive' || moves.length === 0) return;
    chessLocal.undo(); moves.pop(); fens.pop();
    const t = chessLocal.turn();
    if (isBot(t) && moves.length > 0) { chessLocal.undo(); moves.pop(); fens.pop(); }
    result = null; renderBanner(); renderMoves(false);
    ply = fens.length; goToPly(ply); scheduleInteractiveTurn();
}

// ---- stream (bot vs bot) --------------------------------------------------
function startStream() {
    showControls(true, false);
    liveFollow = true;
    const opening = parseInt($('opening-select').value, 10) || 0;
    setStatus(`Live: ${mWhite} vs ${mBlack}... watching moves as they happen.`,
              { thinking: true });
    $('start-btn').disabled = true;

    const url = `/api/arena/stream?white=${encodeURIComponent(mWhite)}` +
                `&black=${encodeURIComponent(mBlack)}&opening=${opening}` +
                `&wmt=${mtFor('w')}&bmt=${mtFor('b')}`;
    evtSource = new EventSource(url);
    evtSource.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'move') {
            moves.push({ san: m.san, ms: m.ms }); fens.push(m.fen);
            renderMoves(true);
            if (liveFollow) goToPly(fens.length);
            else $('ply-indicator').textContent = `${ply} / ${fens.length}`;
        } else if (m.type === 'end') {
            result = m.result; termination = m.termination;
            renderBanner();
            setStatus(`Done: ${m.result} (${m.termination}, ${m.plies} plies). Scrub to replay.`);
        }
    };
    evtSource.addEventListener('done', endStream);
    evtSource.onerror = () => { if (!result) setStatus('Stream ended.'); endStream(); };
}
function endStream() {
    if (evtSource) { evtSource.close(); evtSource = null; }
    $('start-btn').disabled = false;
}

// ---- autoplay (replay) ----------------------------------------------------
let autoTimer = null;
function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } $('play-btn').innerHTML = '&#9654;'; }
function toggleAuto() {
    if (autoTimer) { stopAuto(); return; }
    liveFollow = false;
    if (ply >= fens.length) goToPly(0);
    $('play-btn').innerHTML = '&#10073;&#10073;';
    autoTimer = setInterval(() => {
        if (ply >= fens.length) { stopAuto(); return; }
        goToPly(ply + 1);
    }, 600);
}

window.addEventListener('DOMContentLoaded', () => {
    initBoard(); loadBots(); loadElo();
    $('start-btn').onclick = startGame;
    $('flip-btn').onclick = () => board.flip();
    $('undo-btn').onclick = undoMove;
    $('pause-btn').onclick = () => {
        paused = !paused;
        $('pause-btn').textContent = paused ? 'Resume' : 'Pause';
    };
    $('first-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(0); };
    $('prev-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(ply - 1); };
    $('next-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(ply + 1); };
    $('last-btn').onclick = () => { liveFollow = false; stopAuto(); goToPly(fens.length); };
    $('play-btn').onclick = toggleAuto;
});
