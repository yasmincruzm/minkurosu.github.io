// admin-tracker.js — lógica do widget de visitantes no admin
// importa e chama loadVisitorTracker() após o login

import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function loadVisitorTracker(app) {
    const db        = getFirestore(app);
    const container = document.getElementById('visitor-tracker');
    if (!container) return;

    const deviceIcon = d => d === 'Mobile' ? '📱' : d === 'Tablet' ? '💻' : '🖥️';
    const browserIcon = b => ({
        Chrome: '🟡', Firefox: '🟠', Safari: '🔵', Edge: '🟢', Opera: '🔴'
    })[b] || '🌐';

    const q = query(collection(db, 'visitors'), orderBy('timestamp', 'desc'), limit(30));

    onSnapshot(q, snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="tracker-empty">nenhum visitante ainda.</p>`;
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            const ts = d.timestamp?.toDate();
            const timeStr = ts ? ts.toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }) : '—';

            return `
            <div class="tracker-row">
                <span class="tracker-flag">${deviceIcon(d.device)}</span>
                <div class="tracker-info">
                    <span class="tracker-location">📍 ${d.city}, ${d.country}</span>
                    <span class="tracker-meta">
                        ${browserIcon(d.browser)} ${d.browser} · ${d.os} · ${d.device}
                    </span>
                    <span class="tracker-meta">🌐 ${d.ip} · 🔗 ${d.referrer}</span>
                    <span class="tracker-meta">📄 ${d.page} · ⏰ ${timeStr}</span>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = rows;
    });
}
