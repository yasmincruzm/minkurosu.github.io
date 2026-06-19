import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82"
};

const existing = getApps().find(a => a.options.projectId === firebaseConfig.projectId);
const app = existing || initializeApp(firebaseConfig, 'tracker');
const db = getFirestore(app);

async function fetchWithTimeout(url, ms = 5000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(url, { signal: ctrl.signal });
        clearTimeout(id);
        return r;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

function parseUA(ua) {
    let browser = 'Unknown', os = 'Unknown', device = 'Desktop';
    if (/Edg\//.test(ua))            browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua))    browser = 'Chrome';
    else if (/Firefox\//.test(ua))   browser = 'Firefox';
    else if (/Safari\//.test(ua))    browser = 'Safari';
    if (/Windows/.test(ua))          os = 'Windows';
    else if (/Android/.test(ua))     os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    else if (/Mac OS/.test(ua))      os = 'macOS';
    else if (/Linux/.test(ua))       os = 'Linux';
    if (/Mobile|Android|iPhone/.test(ua)) device = 'Mobile';
    else if (/iPad|Tablet/.test(ua))      device = 'Tablet';
    return { browser, os, device };
}

async function getGeo() {
    const apis = [
        async () => {
            const r = await fetchWithTimeout('https://ip-api.com/json/?fields=status,country,regionName,city,query,countryCode');
            const d = await r.json();
            if (d.status !== 'success') throw new Error('ip-api fail');
            return { ip: d.query, city: d.city, region: d.regionName, country: d.country, cc: d.countryCode };
        },
        async () => {
            const r = await fetchWithTimeout('https://freeipapi.com/api/json');
            const d = await r.json();
            if (!d.ipAddress) throw new Error('freeipapi fail');
            return { ip: d.ipAddress, city: d.cityName, region: d.regionName, country: d.countryName, cc: d.countryCode };
        },
        async () => {
            const r = await fetchWithTimeout('https://ipwho.is/');
            const d = await r.json();
            if (!d.success) throw new Error('ipwho fail');
            return { ip: d.ip, city: d.city, region: d.region, country: d.country, cc: d.country_code };
        },
    ];
    for (const api of apis) {
        try {
            const result = await api();
            if (result.ip && result.ip !== 'unknown') return result;
        } catch { continue; }
    }
    return { ip: 'unknown', city: 'unknown', region: 'unknown', country: 'unknown', cc: '' };
}

const SESSION_KEY = 'mku_sid';
const COUNT_KEY   = 'mku_visits';
const FIRST_KEY   = 'mku_first';

function getSessionData() {
    const raw        = localStorage.getItem(COUNT_KEY);
    const visitCount = raw ? parseInt(raw, 10) + 1 : 1;
    localStorage.setItem(COUNT_KEY, String(visitCount));
    if (!localStorage.getItem(FIRST_KEY)) localStorage.setItem(FIRST_KEY, new Date().toISOString());
    const firstVisit = localStorage.getItem(FIRST_KEY);
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return { visitCount, isNewVisitor: visitCount === 1, firstVisit, sessionId };
}

let currentPage   = null;
let pageStartTime = Date.now();
let maxScroll     = 0;
let hiddenTime    = 0;
let hiddenSince   = null;
let clickCount    = 0;

function resetPageState(pageName) {
    currentPage   = pageName;
    pageStartTime = Date.now();
    maxScroll     = 0;
    clickCount    = 0;
    hiddenTime    = 0;
    hiddenSince   = null;
}

function updateMaxScroll() {
    const pct = Math.round(((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100);
    if (pct > maxScroll) maxScroll = pct;
}

document.addEventListener('scroll', updateMaxScroll, { passive: true });
document.addEventListener('click',  () => clickCount++, { passive: true });
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        hiddenSince = Date.now();
    } else if (hiddenSince) {
        hiddenTime += Date.now() - hiddenSince;
        hiddenSince = null;
    }
});

const sessionData = getSessionData();
const parsedUA    = parseUA(navigator.userAgent);
const geoPromise  = getGeo();

let isAdmin = false;
geoPromise.then(geo => {
    if (geo.ip) sessionStorage.setItem('mku_ip', geo.ip);
    if (localStorage.getItem('mku_admin') === '1') isAdmin = true;
});

async function recordPageView(pageName) {
    if (isAdmin) return;
    try {
        const geo = await geoPromise;
        await addDoc(collection(db, 'visitors'), {
            ip:           geo.ip,
            city:         geo.city    || 'unknown',
            region:       geo.region  || 'unknown',
            country:      geo.country || 'unknown',
            cc:           geo.cc      || '',
            browser:      parsedUA.browser,
            os:           parsedUA.os,
            device:       parsedUA.device,
            page:         `/${pageName}`,
            referrer:     document.referrer || 'direct',
            lang:         navigator.language || 'unknown',
            sessionId:    sessionData.sessionId,
            visitCount:   sessionData.visitCount,
            isNewVisitor: sessionData.isNewVisitor,
            firstVisit:   sessionData.firstVisit,
            maxScroll:    0,
            timestamp:    serverTimestamp()
        });
    } catch (err) {
        console.warn('tracker pageview:', err);
    }
}

async function recordPageExit(pageName) {
    if (isAdmin || !pageName) return;
    updateMaxScroll();
    const activeTime = Math.round((Date.now() - pageStartTime - hiddenTime) / 1000);
    try {
        await addDoc(collection(db, 'visitors_exit'), {
            sessionId:  sessionData.sessionId,
            page:       `/${pageName}`,
            maxScroll,
            activeTime,
            clickCount,
            timestamp:  serverTimestamp()
        });
    } catch { /* silent */ }
}

window.trackPage = async function(pageName) {
    if (currentPage !== null) {
        await recordPageExit(currentPage);
    }
    resetPageState(pageName);
    await recordPageView(pageName);
};

window._trackerReadyFired = true;
window.dispatchEvent(new CustomEvent('tracker:ready'));

window.addEventListener('pagehide', () => {
    if (!isAdmin && currentPage) recordPageExit(currentPage);
}, { once: true });