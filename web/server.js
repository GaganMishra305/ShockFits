const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

const enginePath = path.join(__dirname, '../core/engine');
const engine = spawn(enginePath);

engine.stdout.on('data', (data) => {
    console.log('[ENGINE STDOUT]', data.toString().trim());
});

engine.stderr.on('data', (data) => {
    console.error('[ENGINE STDERR]', data.toString().trim());
});

engine.on('exit', (code) => {
    console.error('Engine exited with code', code);
});

app.post('/api/move', (req, res) => {
    const { moves, fen } = req.body;

    if (!moves || moves.length === 0) {
        return res.json({ error: 'No moves', move: null });
    }

    const movesCsv = moves.join(',');
    const positionCmd = `position ${movesCsv} ${fen || ''}\n`;
    const goCmd = `go\n`;

    let move = '';
    const onData = (data) => {
        move = data.toString().trim();
        engine.stdout.off('data', onData);
        res.json({ move });
    };

    engine.stdout.on('data', onData);

    engine.stdin.write(positionCmd);
    engine.stdin.write(goCmd);
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    engine.stdin.write('quit\n');
    engine.kill();
    process.exit();
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
