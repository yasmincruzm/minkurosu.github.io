
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let myIp = null;

async function getMyIp() {
    try {
        const res  = await fetch('https://ip-api.com/json/?fields=query');
        const data = await res.json();
        myIp = data.query || null;
    } catch {
        myIp = null;
    }
}

function countryFlag(cc) {
    if (!cc || cc.length !== 2) return '🌐';
    return [...cc.toUpperCase()]
        .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
        .join('');
}

const deviceIcon  = d => d === 'Mobile' ? '📱' : d === 'Tablet' ? '💻' : '🖥️';
const browserIcon = b => ({ Chrome: '🟡', Firefox: '🟠', Safari: '🔵', Edge: '🟢', Opera: '🔴' })[b] || '🌐';

export async function loadVisitorTracker(app) {
    await getMyIp();

    const db        = getFirestore(app);
    const container = document.getElementById('visitor-tracker');
    if (!container) return;

    const q = query(collection(db, 'visitors'), orderBy('timestamp', 'desc'), limit(60));

    onSnapshot(q, snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="tracker-empty">nenhum visitante ainda.</p>`;
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();

            const ts      = d.timestamp?.toDate();
            const timeStr = ts
                ? ts.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';

            const flag   = countryFlag(d.cc || '');
            const isMe   = myIp && d.ip === myIp;
            const meClass = isMe ? ' tracker-row-me' : '';
            const meBadge = isMe ? ' <span class="tracker-me-badge">👑 eu</span>' : '';

            const location = [d.city, d.region, d.country]
                .filter(v => v && v !== 'unknown' && v !== '')
                .join(', ') || 'localização desconhecida';

            return `
            <div class="tracker-row${meClass}">
                <span class="tracker-flag">${flag}</span>
                <div class="tracker-info">
                    <span class="tracker-location">${location}${meBadge}</span>
                    <span class="tracker-meta">
                        ${deviceIcon(d.device)} ${d.device} · ${browserIcon(d.browser)} ${d.browser} · ${d.os}
                    </span>
                    <span class="tracker-meta">🌐 ${d.ip} · 🔗 ${d.referrer}</span>
                    <span class="tracker-meta">📄 ${d.page} · ⏰ ${timeStr}</span>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = rows;
    });
}
