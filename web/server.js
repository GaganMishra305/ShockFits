const express = require('express');
const { execFileSync } = require('child_process');
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
        const move = execFileSync(enginePath, [movesString, fen || '']).toString().trim();
        
        res.json({ move });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Engine failed', move: null });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
