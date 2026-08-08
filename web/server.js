const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const enginePath = path.join(__dirname, '../core/engine');

// The engine now speaks UCI. We spawn one process and serialize requests
// through a simple queue (a proper per-game process pool arrives in Phase 7).
const engine = spawn(enginePath);
let ready = false;
let buffer = '';
let pending = null;  // { resolve, onLine }

engine.stdout.on('data', (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        handleLine(line);
    }
});

engine.stderr.on('data', (d) => console.error('[ENGINE]', d.toString().trim()));
engine.on('exit', (code) => console.error('Engine exited with code', code));

function handleLine(line) {
    if (line === 'uciok') { ready = true; return; }
    if (!pending) return;
    if (line.startsWith('bestmove')) {
        const move = line.split(/\s+/)[1];
        const resolve = pending.resolve;
        pending = null;
        resolve(move === '0000' ? null : move);
    }
}

function send(cmd) { engine.stdin.write(cmd + '\n'); }

// Initialize UCI handshake.
send('uci');
send('isready');

// Ask the engine for the best move in a given position.
function bestMove(fen, movetimeMs) {
    return new Promise((resolve) => {
        if (pending) return resolve(null);  // busy; caller should retry
        pending = { resolve };
        send('position fen ' + fen);
        send('go movetime ' + (movetimeMs || 800));
    });
}

app.post('/api/move', async (req, res) => {
    const { fen } = req.body;
    if (!fen) return res.json({ error: 'No FEN', move: null });
    const move = await bestMove(fen, req.body.movetime);
    res.json({ move });
});

process.on('SIGINT', () => {
    send('quit');
    engine.kill();
    process.exit();
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
