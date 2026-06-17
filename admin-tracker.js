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

function scrollBar(pct) {
    if (pct == null) return '';
    const filled = Math.round(pct / 10);
    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return `<span title="scroll máximo: ${pct}%">${bar} ${pct}%</span>`;
}

function visitBadge(count, isNew) {
    if (isNew || count === 1) return `<span class="tracker-badge tracker-badge-new">✨ novo</span>`;
    return `<span class="tracker-badge tracker-badge-return">↩ visita #${count}</span>`;
}

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

            const flag    = countryFlag(d.cc || '');
            const isMe    = myIp && d.ip === myIp;
            const meClass = isMe ? ' tracker-row-me' : '';
            const meBadge = isMe ? ' <span class="tracker-me-badge">👑 eu</span>' : '';

            const location = [d.city, d.region, d.country]
                .filter(v => v && v !== 'unknown' && v !== '')
                .join(', ') || 'localização desconhecida';

            const langStr    = d.lang ? `🗣️ ${d.lang}` : '';
            const scrollStr  = d.maxScroll != null ? `📜 scroll: ${scrollBar(d.maxScroll)}` : '';
            const visitStr   = d.visitCount != null ? visitBadge(d.visitCount, d.isNewVisitor) : '';
            const firstStr   = d.firstVisit && !d.isNewVisitor
                ? `primeira visita: ${new Date(d.firstVisit).toLocaleDateString('pt-BR')}`
                : '';

            const sessionLine = [langStr, scrollStr].filter(Boolean).join(' · ');
            const visitLine   = [visitStr, firstStr].filter(Boolean).join(' · ');

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
                    ${sessionLine  ? `<span class="tracker-meta">${sessionLine}</span>`  : ''}
                    ${visitLine    ? `<span class="tracker-meta">${visitLine}</span>`    : ''}
                </div>
            </div>`;
        }).join('');

        container.innerHTML = rows;
    });
}