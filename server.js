const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const enginePath = path.join(__dirname, 'core', 'engine');

app.post('/api/move', (req, res) => {
    try {
        const { moves } = req.body;
        
        if (!moves || moves.length === 0) {
            return res.json({ error: 'No moves available', move: null });
        }

        const movesString = moves.join('');
        const command = `${enginePath} "${movesString}"`;
        
        const move = execSync(command).toString().trim();
        
        if (move && move.length === 4) {
            res.json({ move });
        } else {
            res.json({ error: 'Invalid move from engine', move: null });
        }
    } catch (error) {
        console.error('Engine error:', error.message);
        res.status(500).json({ error: 'Engine execution failed', move: null });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
