// tracker.js — adiciona no index.html
// coleta ip, cidade, navegador, dispositivo e salva no Firebase

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

// reusa app existente se já inicializado
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

function parseUA(ua) {
    let browser = 'Unknown', os = 'Unknown', device = 'Desktop';

    // browser
    if (/Edg\//.test(ua))             browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua))  browser = 'Opera';
    else if (/Chrome\//.test(ua))     browser = 'Chrome';
    else if (/Firefox\//.test(ua))    browser = 'Firefox';
    else if (/Safari\//.test(ua))     browser = 'Safari';

    // os
    if (/Windows/.test(ua))           os = 'Windows';
    else if (/Android/.test(ua))      os = 'Android';
    else if (/iPhone|iPad/.test(ua))  os = 'iOS';
    else if (/Mac OS/.test(ua))       os = 'macOS';
    else if (/Linux/.test(ua))        os = 'Linux';

    // device
    if (/Mobile|Android|iPhone/.test(ua))  device = 'Mobile';
    else if (/iPad|Tablet/.test(ua))       device = 'Tablet';

    return { browser, os, device };
}

async function track() {
    try {
        // pega IP + localização via API pública gratuita
        const geoRes  = await fetch('https://ipapi.co/json/');
        const geo     = await geoRes.json();

        const ua      = navigator.userAgent;
        const parsed  = parseUA(ua);

        await addDoc(collection(db, 'visitors'), {
            ip:        geo.ip        || 'unknown',
            city:      geo.city      || 'unknown',
            region:    geo.region    || 'unknown',
            country:   geo.country_name || 'unknown',
            browser:   parsed.browser,
            os:        parsed.os,
            device:    parsed.device,
            page:      window.location.pathname,
            referrer:  document.referrer || 'direct',
            timestamp: serverTimestamp()
        });
    } catch (err) {
        // falha silenciosa — não quebra o site
        console.warn('tracker:', err);
    }
}

track();
