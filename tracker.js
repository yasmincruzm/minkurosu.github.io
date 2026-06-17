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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function fetchWithTimeout(url, ms = 4000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

function parseUA(ua) {
    let browser = 'Unknown', os = 'Unknown', device = 'Desktop';

    if (/Edg\//.test(ua))             browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua))  browser = 'Opera';
    else if (/Chrome\//.test(ua))     browser = 'Chrome';
    else if (/Firefox\//.test(ua))    browser = 'Firefox';
    else if (/Safari\//.test(ua))     browser = 'Safari';

    if (/Windows/.test(ua))           os = 'Windows';
    else if (/Android/.test(ua))      os = 'Android';
    else if (/iPhone|iPad/.test(ua))  os = 'iOS';
    else if (/Mac OS/.test(ua))       os = 'macOS';
    else if (/Linux/.test(ua))        os = 'Linux';

    if (/Mobile|Android|iPhone/.test(ua))  device = 'Mobile';
    else if (/iPad|Tablet/.test(ua))       device = 'Tablet';

    return { browser, os, device };
}

async function getGeo() {
    const apis = [
        async () => {
            const r = await fetchWithTimeout('https://ip-api.com/json/?fields=status,message,country,regionName,city,query,countryCode');
            const d = await r.json();
            if (d.status !== 'success') throw new Error('ip-api failed');
            return { ip: d.query, city: d.city, region: d.regionName, country: d.country, cc: d.countryCode };
        },
        async () => {
            const r = await fetchWithTimeout('https://freeipapi.com/api/json');
            const d = await r.json();
            if (!d.ipAddress) throw new Error('freeipapi failed');
            return { ip: d.ipAddress, city: d.cityName, region: d.regionName, country: d.countryName, cc: d.countryCode };
        },
        async () => {
            const r = await fetchWithTimeout('https://ipwho.is/');
            const d = await r.json();
            if (!d.success) throw new Error('ipwho failed');
            return { ip: d.ip, city: d.city, region: d.region, country: d.country, cc: d.country_code };
        },
        async () => {
            const r = await fetchWithTimeout('https://ipapi.co/json/');
            const d = await r.json();
            if (!d.ip || d.error) throw new Error('ipapi.co failed');
            return { ip: d.ip, city: d.city, region: d.region, country: d.country_name, cc: d.country_code };
        },
        async () => {
            const r = await fetchWithTimeout('https://api64.ipify.org?format=json');
            const d = await r.json();
            return { ip: d.ip, city: 'unknown', region: 'unknown', country: 'unknown', cc: '' };
        }
    ];

    for (const api of apis) {
        try {
            const result = await api();
            if (result.city && result.city !== 'unknown' && result.city !== '') return result;
        } catch { continue; }
    }

    return { ip: 'unknown', city: 'unknown', region: 'unknown', country: 'unknown', cc: '' };
}


const SESSION_KEY  = 'mku_sid';
const COUNT_KEY    = 'mku_visits';
const FIRST_KEY    = 'mku_first';

function getSessionData() {
    const raw        = localStorage.getItem(COUNT_KEY);
    const visitCount = raw ? parseInt(raw, 10) + 1 : 1;
    const isNewVisitor = visitCount === 1;
    localStorage.setItem(COUNT_KEY, String(visitCount));

    if (!localStorage.getItem(FIRST_KEY)) {
        localStorage.setItem(FIRST_KEY, new Date().toISOString());
    }
    const firstVisit = localStorage.getItem(FIRST_KEY);

    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    return { visitCount, isNewVisitor, firstVisit, sessionId };
}


let maxScroll    = 0;
let hiddenTime   = 0;
let hiddenSince  = null;
const pageStart  = Date.now();

function updateMaxScroll() {
    const scrolled  = window.scrollY + window.innerHeight;
    const total     = document.documentElement.scrollHeight;
    const pct       = Math.round((scrolled / total) * 100);
    if (pct > maxScroll) maxScroll = pct;
}

document.addEventListener('scroll', updateMaxScroll, { passive: true });

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        hiddenSince = Date.now();
    } else {
        if (hiddenSince) {
            hiddenTime += Date.now() - hiddenSince;
            hiddenSince = null;
        }
    }
});


async function track() {
    try {
        const geo     = await getGeo();
        const parsed  = parseUA(navigator.userAgent);
        const session = getSessionData();

        const lang = navigator.language || 'unknown';

        await addDoc(collection(db, 'visitors'), {
            ip:        geo.ip,
            city:      geo.city      || 'unknown',
            region:    geo.region    || 'unknown',
            country:   geo.country   || 'unknown',
            cc:        geo.cc        || '',
            browser:   parsed.browser,
            os:        parsed.os,
            device:    parsed.device,
            page:      window.location.pathname,
            referrer:  document.referrer || 'direct',
            lang,
            sessionId:    session.sessionId,
            visitCount:   session.visitCount,
            isNewVisitor: session.isNewVisitor,
            firstVisit:   session.firstVisit,
            maxScroll,
            timestamp: serverTimestamp()
        });

        window.addEventListener('pagehide', async () => {
            updateMaxScroll();
            const activeTime = Math.round((Date.now() - pageStart - hiddenTime) / 1000);
            try {
                await addDoc(collection(db, 'visitors_exit'), {
                    sessionId:  session.sessionId,
                    page:       window.location.pathname,
                    maxScroll,
                    activeTime, 
                    timestamp:  serverTimestamp()
                });
            } catch { /* silent */ }
        }, { once: true });

    } catch (err) {
        console.warn('tracker:', err);
    }
}

track();