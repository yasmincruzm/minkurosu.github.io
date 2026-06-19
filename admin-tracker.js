import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let myIp = null;

async function getMyIp() {
    try {
        const res  = await fetch('https://ip-api.com/json/?fields=query');
        const data = await res.json();
        myIp = data.query || null;
    } catch { myIp = null; }
}

function countryFlag(cc) {
    if (!cc || cc.length !== 2) return '🌐';
    return [...cc.toUpperCase()]
        .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
        .join('');
}

function fmtTime(seconds) {
    if (seconds == null || seconds < 0) return null;
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeAgo(date) {
    if (!date) return '—';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return `${diff}s atrás`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return date.toLocaleDateString('pt-BR');
}

function scrollBar(pct) {
    if (pct == null) return '—';
    const filled = Math.round(pct / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
}

function deviceIcon(d) {
    if (d === 'Mobile') return '📱';
    if (d === 'Tablet') return '💻';
    return '🖥️';
}

function browserIcon(b) {
    return ({ Chrome: '🟡', Firefox: '🟠', Safari: '🔵', Edge: '🟢', Opera: '🔴' })[b] || '🌐';
}

function ipAvatar(ip) {
    if (!ip || ip === 'unknown') return '??';
    const parts = ip.split('.');
    if (parts.length >= 2) return parts[0].slice(-1) + parts[1].slice(-1);
    return ip.slice(0, 2);
}

function ipColor(ip) {
    if (!ip) return '#534F4A';
    let hash = 0;
    for (const c of ip) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 30%, 35%)`;
}

function renderCard(d, exit, isMe) {
    const flag     = countryFlag(d.cc || '');
    const ts       = d.timestamp?.toDate();
    const ago      = timeAgo(ts);
    const location = [d.city, d.region, d.country]
        .filter(v => v && v !== 'unknown' && v !== '')
        .join(', ') || 'localização desconhecida';

    const isNew    = d.isNewVisitor || d.visitCount === 1;
    const visitLabel = isNew
        ? `<span class="vc-badge vc-badge-new">novo visitante</span>`
        : `<span class="vc-badge vc-badge-return">visita #${d.visitCount}</span>`;

    const firstVisitLine = d.firstVisit && !isNew
        ? `<div class="vc-row"><span class="vc-key">1ª visita</span><span class="vc-val">${new Date(d.firstVisit).toLocaleDateString('pt-BR')}</span></div>`
        : '';

    const referrerDisplay = !d.referrer || d.referrer === 'direct'
        ? 'direto'
        : d.referrer.length > 35 ? d.referrer.slice(0, 35) + '…' : d.referrer;

    const activeTimeStr = exit?.activeTime != null ? fmtTime(exit.activeTime) : null;
    const clickStr      = exit?.clickCount  != null ? `${exit.clickCount} cliques` : null;
    const scrollStr     = (exit?.maxScroll ?? d.maxScroll) != null ? scrollBar(exit?.maxScroll ?? d.maxScroll) : null;

    const avatar    = ipAvatar(d.ip);
    const avatarBg  = isMe ? '#3a3330' : ipColor(d.ip);
    const meBadge   = isMe ? `<span class="vc-me">👑 eu</span>` : '';

    return `
    <div class="vc-card${isMe ? ' vc-card-me' : ''}" data-ip="${d.ip}">
        <div class="vc-header">
            <div class="vc-avatar" style="background:${avatarBg}">${avatar}</div>
            <div class="vc-header-info">
                <span class="vc-location">${flag} ${location}${meBadge}</span>
                <span class="vc-ago">${ago}</span>
            </div>
            ${visitLabel}
        </div>
        <div class="vc-body">
            <div class="vc-row"><span class="vc-key">dispositivo</span><span class="vc-val">${deviceIcon(d.device)} ${d.device} · ${browserIcon(d.browser)} ${d.browser} · ${d.os}</span></div>
            <div class="vc-row"><span class="vc-key">página</span><span class="vc-val">${d.page || '—'}</span></div>
            <div class="vc-row"><span class="vc-key">origem</span><span class="vc-val">${referrerDisplay}</span></div>
            <div class="vc-row"><span class="vc-key">idioma</span><span class="vc-val">${d.lang || '—'}</span></div>
            ${firstVisitLine}
            <div class="vc-divider"></div>
            <div class="vc-row"><span class="vc-key">scroll</span><span class="vc-val vc-mono">${scrollStr || '—'}</span></div>
            ${activeTimeStr ? `<div class="vc-row"><span class="vc-key">tempo ativo</span><span class="vc-val">${activeTimeStr}</span></div>` : ''}
            ${clickStr      ? `<div class="vc-row"><span class="vc-key">cliques</span><span class="vc-val">${clickStr}</span></div>` : ''}
        </div>
    </div>`;
}

function renderAnalytics(byIp) {
    const section = document.getElementById('analytics-section');
    if (!section) return;

    const all = Object.values(byIp);
    const total   = all.length;
    const newV    = all.filter(d => d.isNewVisitor || d.visitCount === 1).length;
    const returnV = total - newV;

    const pages    = {}, countries = {}, devices = {}, browsers = {}, refs = {};
    all.forEach(d => {
        if (d.page)    pages[d.page]       = (pages[d.page]       || 0) + 1;
        if (d.country && d.country !== 'unknown') countries[d.country] = (countries[d.country] || 0) + 1;
        if (d.device)  devices[d.device]   = (devices[d.device]   || 0) + 1;
        if (d.browser) browsers[d.browser] = (browsers[d.browser] || 0) + 1;
        const r = (!d.referrer || d.referrer === 'direct') ? 'direto' : d.referrer;
        refs[r] = (refs[r] || 0) + 1;
    });

    const top = (obj, n = 5) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
    const bar = (v, max) => {
        const pct = max ? Math.round((v / max) * 100) : 0;
        return `<span class="an-bar" style="--pct:${pct}%"></span>`;
    };
    const tbl = (title, rows) => {
        if (!rows.length) return '';
        const max = rows[0][1];
        return `<div class="an-block"><span class="an-label">${title}</span>${
            rows.map(([k, v]) => `<div class="an-row"><span class="an-key">${k}</span>${bar(v, max)}<span class="an-val">${v}</span></div>`).join('')
        }</div>`;
    };

    section.innerHTML = `
    <div class="an-stats">
        <div class="an-stat"><span class="an-n">${total}</span><span class="an-l">visitantes únicos</span></div>
        <div class="an-stat"><span class="an-n">${newV}</span><span class="an-l">novos</span></div>
        <div class="an-stat"><span class="an-n">${returnV}</span><span class="an-l">retornos</span></div>
    </div>
    <div class="an-grid">
        ${tbl('páginas', top(pages))}
        ${tbl('países', top(countries))}
        ${tbl('dispositivos', top(devices))}
        ${tbl('navegadores', top(browsers))}
        ${tbl('origem', top(refs))}
    </div>`;
}

export async function loadVisitorTracker(app) {
    await getMyIp();

    const db        = getFirestore(app);
    const container = document.getElementById('visitor-tracker');
    if (!container) return;

    const q     = query(collection(db, 'visitors'),      orderBy('timestamp', 'desc'), limit(200));
    const qExit = query(collection(db, 'visitors_exit'), orderBy('timestamp', 'desc'), limit(400));

    const exitMap = {};
    onSnapshot(qExit, snap => {
        snap.docs.forEach(doc => {
            const d = doc.data();
            const key = (d.sessionId || '') + (d.page || '');
            if (key && !exitMap[key]) exitMap[key] = d;
        });
    });

    onSnapshot(q, snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="tracker-empty">nenhum visitante ainda.</p>`;
            return;
        }

        const byIp = {};
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (!d.ip || d.ip === 'unknown') return;
            if (d.ip === myIp) return; // ignora visitas do admin
            if (!byIp[d.ip]) byIp[d.ip] = d;
        });

        renderAnalytics(byIp);

        const sorted = Object.values(byIp).sort((a, b) => {
            const ta = a.timestamp?.toDate?.()?.getTime() || 0;
            const tb = b.timestamp?.toDate?.()?.getTime() || 0;
            return tb - ta;
        });

        const html = sorted.map(d => {
            const exit = exitMap[(d.sessionId || '') + (d.page || '')] || {};
            const isMe = myIp && d.ip === myIp;
            return renderCard(d, exit, isMe);
        }).join('');

        container.innerHTML = html;
    });
}