// Dashboard: fetch tournament JSON and render standings, Elo, crosstable,
// and the Stockfish gauntlet (W/D/L + SPRT verdict).

const COLORS = ['#667eea', '#764ba2', '#43a047', '#e53935', '#fb8c00',
                '#00acc1', '#8e24aa', '#3949ab'];

async function loadJSON(path) {
    try {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    } catch (_) {
        return null;
    }
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

// ---------------- Bots Royale ----------------
function renderRoyale(data) {
    if (!data) { show('royale-empty'); return; }
    show('royale-body');

    const st = data.standings;
    const table = document.getElementById('standings');
    table.innerHTML =
        '<tr><th>#</th><th>Bot</th><th>Pts</th><th>W-D-L</th><th>Elo</th></tr>' +
        st.map(s => `<tr class="rank-${s.rank}">
            <td>${s.rank}</td><td>${s.name}</td>
            <td>${s.points.toFixed(1)}</td>
            <td>${s.wins}-${s.draws}-${s.losses}</td>
            <td>${s.elo >= 0 ? '+' : ''}${s.elo.toFixed(0)} ±${s.elo_margin.toFixed(0)}</td>
        </tr>`).join('');

    new Chart(document.getElementById('eloChart'), {
        type: 'bar',
        data: {
            labels: st.map(s => s.name),
            datasets: [{
                label: 'Elo',
                data: st.map(s => s.elo),
                backgroundColor: st.map((_, i) => COLORS[i % COLORS.length]),
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { title: { display: true, text: 'Elo vs field' } } }
        }
    });

    // Crosstable
    const bots = data.bots;
    const ct = document.getElementById('crosstable');
    let head = '<tr><th>vs</th>' + bots.map(b => `<th>${b}</th>`).join('') + '</tr>';
    let rows = bots.map(a => {
        const cells = bots.map(b => {
            if (a === b) return '<td style="background:#f0f0f0">—</td>';
            const c = (data.crosstable[a] || {})[b];
            if (!c) return '<td>·</td>';
            return `<td>${c.score.toFixed(1)} <span class="muted">(${c.w}-${c.d}-${c.l})</span></td>`;
        }).join('');
        return `<tr><th>${a}</th>${cells}</tr>`;
    }).join('');
    ct.innerHTML = head + rows;
}

// ---------------- Stockfish Gauntlet ----------------
function renderGauntlet(data) {
    if (!data) { show('gauntlet-empty'); return; }
    show('gauntlet-body');

    const pct = (data.score_rate * 100).toFixed(1);
    document.getElementById('gauntlet-stats').innerHTML = `
        <div class="stat"><div class="val">${data.challenger}</div><div class="lbl">vs ${data.opponent}</div></div>
        <div class="stat"><div class="val">${data.wins}-${data.draws}-${data.losses}</div><div class="lbl">W-D-L (${data.games_played} games)</div></div>
        <div class="stat"><div class="val">${pct}%</div><div class="lbl">Score</div></div>
        <div class="stat"><div class="val">${data.elo >= 0 ? '+' : ''}${data.elo.toFixed(0)}</div><div class="lbl">Elo ±${data.elo_margin.toFixed(0)}</div></div>
    `;

    new Chart(document.getElementById('wdlChart'), {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Draws', 'Losses'],
            datasets: [{
                data: [data.wins, data.draws, data.losses],
                backgroundColor: ['#43a047', '#fb8c00', '#e53935'],
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Gauntlet results' } }
        }
    });

    const s = data.sprt;
    const box = document.getElementById('sprt-box');
    const cls = s.verdict.includes('H1') ? 'sprt-h1'
              : s.verdict.includes('H0') ? 'sprt-h0' : 'sprt-cont';
    box.className = cls;
    box.innerHTML = `<b>${s.verdict}</b><br>
        LLR ${s.llr.toFixed(2)} &nbsp;(bounds [${s.lower.toFixed(2)}, ${s.upper.toFixed(2)}])<br>
        <span class="muted">H0: ${data.settings.elo0} Elo &nbsp;|&nbsp; H1: ${data.settings.elo1} Elo</span>`;

    const ul = document.getElementById('gauntlet-games');
    ul.innerHTML = (data.games_meta || []).slice(-12).reverse().map(g => {
        const r = g.result === '1/2-1/2' ? '<span class="res-d">½-½</span>'
                : g.result === '1-0' ? '<span class="res-w">1-0</span>'
                : '<span class="res-l">0-1</span>';
        return `<li>${g.white} vs ${g.black} &nbsp;${r} <span class="muted">(${g.termination}, ${g.plies} plies)</span></li>`;
    }).join('');
}

async function main() {
    const [royale, gauntlet] = await Promise.all([
        loadJSON('data/royale.json'),
        loadJSON('data/gauntlet.json'),
    ]);

    const stamps = [royale, gauntlet].filter(Boolean).map(d => d.generated);
    document.getElementById('generated').textContent = stamps.length
        ? `Last updated: ${stamps.sort().reverse()[0]}`
        : 'No results yet — run a royale or gauntlet from the CLI.';

    renderRoyale(royale);
    renderGauntlet(gauntlet);
}

main();
