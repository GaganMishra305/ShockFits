const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const REPO_ROOT = path.join(__dirname, '..');
const BOTS_DIR = path.join(REPO_ROOT, 'bots');
// Prefer the project venv python (has python-chess); fall back to system.
const VENV_PY = path.join(REPO_ROOT, '.venv/bin/python');
const PYTHON = fs.existsSync(VENV_PY) ? VENV_PY : 'python3';

// All engine work (human-vs-bot moves and bot-vs-bot games) now runs through the
// Python arena helpers, which drive the UCI engines. No persistent engine here.

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

// ---- Elo: latest calibration result --------------------------------------
app.get('/api/elo', (req, res) => {
    const candidates = [
        path.join(REPO_ROOT, 'web/data/elo.json'),
        path.join(REPO_ROOT, 'docs/elo.json'),
    ];
    for (const f of candidates) {
        try {
            if (fs.existsSync(f)) return res.json(JSON.parse(fs.readFileSync(f)));
        } catch (e) { /* try next */ }
    }
    res.json({ estimate_elo: null });
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

// ---- Arena: LIVE stream a game (Server-Sent Events) -----------------------
app.get('/api/arena/stream', (req, res) => {
    const { white, black } = req.query;
    const opening = parseInt(req.query.opening, 10) || 0;
    if (!white || !black) {
        return res.status(400).json({ error: 'white and black are required' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.write('retry: 10000\n\n');

    const args = ['-m', 'tools.arena.play_one', '--stream',
        '--white', String(white), '--black', String(black),
        '--opening', String(opening)];
    const proc = spawn(PYTHON, args, { cwd: REPO_ROOT });

    let buf = '';
    proc.stdout.on('data', (d) => {
        buf += d.toString();
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (line) res.write(`data: ${line}\n\n`);
        }
    });
    proc.stderr.on('data', (d) => console.error('[STREAM]', d.toString().trim()));
    proc.on('close', () => {
        res.write('event: done\ndata: {}\n\n');
        res.end();
    });

    // Kill the game if the browser disconnects (no zombie engines).
    req.on('close', () => { if (!proc.killed) proc.kill(); });
});

// ---- Play: get a chosen bot's move for a position -------------------------
app.post('/api/bot-move', (req, res) => {
    const { fen, bot } = req.body || {};
    if (!fen || !bot) {
        return res.status(400).json({ error: 'fen and bot are required' });
    }
    const args = ['-m', 'tools.arena.bot_move', '--bot', String(bot),
        '--fen', String(fen)];
    const proc = spawn(PYTHON, args, { cwd: REPO_ROOT });
    let out = '', err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('close', (code) => {
        if (code !== 0) {
            console.error('[BOT-MOVE]', err.trim());
            return res.status(500).json({ error: err.trim() || 'bot-move failed' });
        }
        try { res.json(JSON.parse(out)); }
        catch (e) { res.status(500).json({ error: 'bad bot output' }); }
    });
});

process.on('SIGINT', () => {
    process.exit();
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
