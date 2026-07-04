import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82"
};

const existing = getApps().find(a => a.name === "[DEFAULT]");
const app = existing || initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchWithTimeout(url, ms = 2500) {
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
    const apiCalls = [
        (async () => {
            const r = await fetchWithTimeout('https://freeipapi.com/api/json');
            const d = await r.json();
            if (!d.ipAddress) throw new Error('freeipapi fail');
            return { ip: d.ipAddress, city: d.cityName, region: d.regionName, country: d.countryName, cc: d.countryCode };
        })(),
        (async () => {
            const r = await fetchWithTimeout('https://ipwho.is/');
            const d = await r.json();
            if (!d.success) throw new Error('ipwho fail');
            return { ip: d.ip, city: d.city, region: d.region, country: d.country, cc: d.country_code };
        })(),
        (async () => {
            const r = await fetchWithTimeout('https://api.ipify.org?format=json');
            const d = await r.json();
            if (!d.ip) throw new Error('ipify fail');
            return { ip: d.ip, city: 'unknown', region: 'unknown', country: 'unknown', cc: '' };
        })(),
    ];

    try {
        const result = await Promise.any(apiCalls);
        if (result.ip && result.ip !== 'unknown') return result;
    } catch {
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

const subpageClickBuffer = {};

function getSubpageLabel(el) {
    if (el.dataset.subpage) return el.dataset.subpage;
    if (el.dataset.tab)     return el.dataset.tab;
    if (el.dataset.page)    return el.dataset.page;
    const parent = el.closest('[data-page]');
    if (parent && parent !== el) return parent.dataset.page;
    return null;
}

document.addEventListener('click', e => {
    const target = e.target.closest('[data-subpage],[data-tab],[data-page]');
    if (!target) return;
    const label = getSubpageLabel(target);
    if (!label) return;
    subpageClickBuffer[label] = (subpageClickBuffer[label] || 0) + 1;
}, { passive: true });

async function flushSubpageClicks() {
    if (isAdmin) return;
    const entries = Object.entries(subpageClickBuffer);
    if (!entries.length) return;
    const toSend = { ...subpageClickBuffer };
    Object.keys(subpageClickBuffer).forEach(k => delete subpageClickBuffer[k]);

    try {
        const geo = await geoPromise;
        for (const [subpage, count] of Object.entries(toSend)) {
            await addDoc(collection(db, 'subpage_clicks'), {
                sessionId:  sessionData.sessionId,
                ip:         geo.ip,
                page:       currentPage ? `/${currentPage}` : '/',
                subpage,
                count,
                timestamp:  serverTimestamp()
            });
        }
    } catch (err) {
        
        Object.entries(toSend).forEach(([k, v]) => {
            subpageClickBuffer[k] = (subpageClickBuffer[k] || 0) + v;
        });
    }
}

setInterval(flushSubpageClicks, 30_000);

const sessionData = getSessionData();
const parsedUA    = parseUA(navigator.userAgent);
const geoPromise  = getGeo();

let isAdmin = false;
geoPromise.then(geo => {
    if (geo.ip) sessionStorage.setItem('mku_ip', geo.ip);
});
if (localStorage.getItem('mku_admin') === '1') isAdmin = true;

let currentVisitDocRef = null;


const pendingRetries = [];

async function withRetry(fn, label, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            
            if (i === attempts - 1) throw err;
            await new Promise(res => setTimeout(res, 500 * (i + 1)));
        }
    }
}

async function recordPageView(pageName) {
    if (isAdmin) return;
    try {
        currentVisitDocRef = await withRetry(() => addDoc(collection(db, 'visitors'), {
            ip:           'unknown',
            city:         'unknown',
            region:       'unknown',
            country:      'unknown',
            cc:           '',
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
        }), 'pageview');

        const docRefAtCreation = currentVisitDocRef;
        geoPromise.then(async geo => {
            if (isAdmin || !geo.ip || geo.ip === 'unknown') return;
            try {
                await withRetry(() => updateDoc(docRefAtCreation, {
                    ip:      geo.ip,
                    city:    geo.city    || 'unknown',
                    region:  geo.region  || 'unknown',
                    country: geo.country || 'unknown',
                    cc:      geo.cc      || ''
                }), 'geo update');
            } catch (err) {
                
            }
        });
    } catch (err) {
        
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
    } catch {  }
    await flushSubpageClicks();
}

window.markVisit = async function(pageName) {
    if (currentPage !== null) {
        await recordPageExit(currentPage);
    }
    resetPageState(pageName);
    await recordPageView(pageName);
};

window._appReadyFired = true;
window.dispatchEvent(new CustomEvent('app:ready'));

window.addEventListener('pagehide', () => {
    if (!isAdmin && currentPage) {
        recordPageExit(currentPage);
        flushSubpageClicks();
    }
}, { once: true });