const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/move', (req, res) => {
    try {
        const { moves, fen } = req.body;

        if (!moves || moves.length === 0) {
            return res.json({ error: 'No moves', move: null });
        }

        const enginePath = path.join(__dirname, '../core/engine');
        const movesString = moves.join(',');

        const engine = spawn(enginePath, [movesString, fen || '']);

        let output = '';
        let errorOutput = '';

        engine.stdout.on('data', (data) => {
            output += data.toString();
        });

        engine.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        engine.on('close', (code) => {
            if (code !== 0) {
                console.error('Engine exited with code:', code);
                console.error('Engine stderr:', errorOutput);
                return res.status(500).json({ error: 'Engine failed', move: null });
            }

            const move = output.trim();
            console.log('Engine move:', move);

            res.json({ move });
        });

        engine.on('error', (err) => {
            console.error('Spawn error:', err.message);
            res.status(500).json({ error: 'Engine spawn failed', move: null });
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Engine failed', move: null });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});