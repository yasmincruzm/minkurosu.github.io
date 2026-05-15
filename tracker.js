// tracker.js — importado no index.html
// coleta ip, cidade, navegador, dispositivo e salva no Firebase
// usa múltiplas APIs de geo como fallback

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

// tenta cada API em ordem até uma funcionar
async function getGeo() {
    const apis = [
        async () => {
            const r = await fetch('https://ipapi.co/json/');
            const d = await r.json();
            if (!d.ip || d.error) throw new Error('ipapi failed');
            return { ip: d.ip, city: d.city, region: d.region, country: d.country_name };
        },
        async () => {
            const r = await fetch('https://ip-api.com/json/?fields=status,message,country,regionName,city,query');
            const d = await r.json();
            if (d.status !== 'success') throw new Error('ip-api failed');
            return { ip: d.query, city: d.city, region: d.regionName, country: d.country };
        },
        async () => {
            const r = await fetch('https://freeipapi.com/api/json');
            const d = await r.json();
            if (!d.ipAddress) throw new Error('freeipapi failed');
            return { ip: d.ipAddress, city: d.cityName, region: d.regionName, country: d.countryName };
        },
        async () => {
            // último fallback — só pega o IP, sem geo
            const r = await fetch('https://api64.ipify.org?format=json');
            const d = await r.json();
            return { ip: d.ip, city: 'unknown', region: 'unknown', country: 'unknown' };
        }
    ];

    for (const api of apis) {
        try {
            return await api();
        } catch {
            continue;
        }
    }

    // se tudo falhar, ainda salva a visita sem IP
    return { ip: 'unknown', city: 'unknown', region: 'unknown', country: 'unknown' };
}

async function track() {
    try {
        const geo    = await getGeo();
        const parsed = parseUA(navigator.userAgent);

        await addDoc(collection(db, 'visitors'), {
            ip:        geo.ip,
            city:      geo.city      || 'unknown',
            region:    geo.region    || 'unknown',
            country:   geo.country   || 'unknown',
            browser:   parsed.browser,
            os:        parsed.os,
            device:    parsed.device,
            page:      window.location.pathname,
            referrer:  document.referrer || 'direct',
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.warn('tracker:', err);
    }
}

track();