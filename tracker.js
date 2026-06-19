import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82"
};

function getOrInitApp() {
    const apps = getApps();
    if (apps.length > 0) return apps[0];
    return initializeApp(firebaseConfig);
}

const db = getFirestore(getOrInitApp());

async function fetchGeo() {
    try {
        const r = await fetch('https://ip-api.com/json/?fields=status,country,regionName,city,query,countryCode');
        const d = await r.json();
        if (d.status === 'success') return { ip: d.query, city: d.city, region: d.regionName, country: d.country, cc: d.countryCode };
    } catch {}
    try {
        const r = await fetch('https://freeipapi.com/api/json');
        const d = await r.json();
        if (d.ipAddress) return { ip: d.ipAddress, city: d.cityName, region: d.regionName, country: d.countryName, cc: d.countryCode };
    } catch {}
    return { ip: 'unknown', city: 'unknown', region: 'unknown', country: 'unknown', cc: '' };
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

function getSessionData() {
    const COUNT_KEY = 'mku_visits', FIRST_KEY = 'mku_first', SID_KEY = 'mku_sid';
    const raw = localStorage.getItem(COUNT_KEY);
    const visitCount = raw ? parseInt(raw, 10) + 1 : 1;
    localStorage.setItem(COUNT_KEY, String(visitCount));
    if (!localStorage.getItem(FIRST_KEY)) localStorage.setItem(FIRST_KEY, new Date().toISOString());
    let sessionId = sessionStorage.getItem(SID_KEY);
    if (!sessionId) { sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(SID_KEY, sessionId); }
    return { visitCount, isNewVisitor: visitCount === 1, firstVisit: localStorage.getItem(FIRST_KEY), sessionId };
}

let currentPage   = 'aboutme';
let pageStartTime = Date.now();
let maxScroll     = 0;
let hiddenTime    = 0;
let hiddenSince   = null;
let clickCount    = 0;
let firstPage     = true;
let isAdmin       = localStorage.getItem('mku_admin') === '1';

const geoPromise  = fetchGeo();
const session     = getSessionData();
const ua          = parseUA(navigator.userAgent);

document.addEventListener('scroll', () => {
    const pct = Math.round(((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100);
    if (pct > maxScroll) maxScroll = pct;
}, { passive: true });
document.addEventListener('click', () => { clickCount++; }, { passive: true });
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenSince = Date.now(); }
    else if (hiddenSince) { hiddenTime += Date.now() - hiddenSince; hiddenSince = null; }
});

async function savePageView(pageName) {
    if (isAdmin) return;
    const geo = await geoPromise;
    try {
        await addDoc(collection(db, 'visitors'), {
            ip: geo.ip, city: geo.city, region: geo.region, country: geo.country, cc: geo.cc,
            browser: ua.browser, os: ua.os, device: ua.device,
            page: `/${pageName}`,
            referrer: document.referrer || 'direct',
            lang: navigator.language || 'unknown',
            sessionId: session.sessionId,
            visitCount: session.visitCount,
            isNewVisitor: session.isNewVisitor,
            firstVisit: session.firstVisit,
            maxScroll: 0,
            timestamp: serverTimestamp()
        });
    } catch (e) { console.warn('tracker save:', e); }
}

async function savePageExit(pageName) {
    if (isAdmin) return;
    const pct = Math.round(((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100);
    if (pct > maxScroll) maxScroll = pct;
    const activeTime = Math.round((Date.now() - pageStartTime - hiddenTime) / 1000);
    try {
        await addDoc(collection(db, 'visitors_exit'), {
            sessionId: session.sessionId,
            page: `/${pageName}`,
            maxScroll, activeTime, clickCount,
            timestamp: serverTimestamp()
        });
    } catch {}
}

window.trackPage = async function(pageName) {
    isAdmin = localStorage.getItem('mku_admin') === '1';
    if (!firstPage) await savePageExit(currentPage);
    firstPage     = false;
    currentPage   = pageName;
    pageStartTime = Date.now();
    maxScroll     = 0;
    clickCount    = 0;
    await savePageView(pageName);
};

window.dispatchEvent(new CustomEvent('tracker:ready'));

window.addEventListener('pagehide', () => {
    if (!isAdmin) savePageExit(currentPage);
}, { once: true });