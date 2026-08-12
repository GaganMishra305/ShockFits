const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const REPO_ROOT = path.join(__dirname, '..');
const enginePath = path.join(REPO_ROOT, 'core/engine');
const BOTS_DIR = path.join(REPO_ROOT, 'bots');
// Prefer the project venv python (has python-chess); fall back to system.
const VENV_PY = path.join(REPO_ROOT, '.venv/bin/python');
const PYTHON = fs.existsSync(VENV_PY) ? VENV_PY : 'python3';

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

// ---- Arena: list fighters -------------------------------------------------
app.get('/api/bots', (req, res) => {
    let bots = [];
    try {
        bots = fs.readdirSync(BOTS_DIR)
            .filter((f) => f.endsWith('.json'))
            .map((f) => JSON.parse(fs.readFileSync(path.join(BOTS_DIR, f))))
            .map((b) => ({ name: b.name, description: b.description || '' }));
    } catch (e) {
        console.error('[BOTS]', e.message);
    }
    // Stockfish pseudo-bots at a few skill levels.
    const stockfish = [0, 3, 5, 8, 12, 20].map((s) => ({
        name: `stockfish-skill${s}`,
        description: `Stockfish (Skill Level ${s})`,
    }));
    res.json({ bots, stockfish });
});

// ---- Arena: run a single game on demand -----------------------------------
app.post('/api/arena/run', (req, res) => {
    const { white, black, opening } = req.body || {};
    if (!white || !black) {
        return res.status(400).json({ error: 'white and black are required' });
    }
    const args = ['-m', 'tools.arena.play_one',
        '--white', String(white), '--black', String(black),
        '--opening', String(Number.isInteger(opening) ? opening : 0)];
    const proc = spawn(PYTHON, args, { cwd: REPO_ROOT });

    let out = '', err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('close', (code) => {
        if (code !== 0) {
            console.error('[ARENA]', err.trim());
            return res.status(500).json({ error: err.trim() || 'game failed' });
        }
        try {
            res.json(JSON.parse(out));
        } catch (e) {
            res.status(500).json({ error: 'bad game output: ' + e.message });
        }
    });
});

process.on('SIGINT', () => {
    send('quit');
    engine.kill();
    process.exit();
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
