
(function () {
if (window.__siteScriptLoaded) return;   
window.__siteScriptLoaded = true;














function lockTheme() {
    try { localStorage.removeItem('theme'); } catch (e) {}   

    const link = document.getElementById('theme-stylesheet');
    if (link && !/emo\.css/.test(link.getAttribute('href') || '')) {
        link.setAttribute('href', 'emo.css?v=4');
    }
}







function initCarrossel() {
    try {

        document.querySelectorAll('.track-inner, .track-inner2').forEach(inner => {
            if (inner.dataset.duplicated) return;


            Array.from(inner.children).forEach(el => {
                const clone = el.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                inner.appendChild(clone);
            });
            inner.dataset.duplicated = '1';

            











            const speed = parseFloat(inner.dataset.speed) ||
                (inner.classList.contains('track-inner2') ? 30 : 40);

            const updateDuration = () => {
                const half = inner.scrollWidth / 2;
                if (half > 0) inner.style.setProperty('--track-duration', (half / speed) + 's');
            };

            updateDuration();
            inner.querySelectorAll('img').forEach(img => {
                if (!img.complete) img.addEventListener('load', updateDuration, { once: true });
            });
            if ('ResizeObserver' in window) new ResizeObserver(updateDuration).observe(inner);
        });
    } catch (e) { console.error('[carrossel]', e); }
}















function applyTransform(el, x, y, rotation) {
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
}

function initializeDrag() {
    try {
        if (typeof interact === 'undefined') return;
        interact('.draggable').draggable({
            inertia: false,
            modifiers: [interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })],
            autoScroll: false,
            listeners: {
                move: function (event) {
                    const target = event.target;
                    let x = (parseFloat(target.dataset.x) || 0) + event.dx;
                    let y = (parseFloat(target.dataset.y) || 0) + event.dy;
                    const rotation = parseFloat(target.dataset.rotation) || 0;
                    applyTransform(target, x, y, rotation);
                    target.dataset.x = x;
                    target.dataset.y = y;
                }
            }
        });
        document.querySelectorAll('.draggable').forEach(item => {
            const rotation = parseFloat(item.dataset.rotation) || 0;
            const x = parseFloat(item.dataset.x) || 0;
            const y = parseFloat(item.dataset.y) || 0;
            applyTransform(item, x, y, rotation);
        });
    } catch (e) { console.error('[drag]', e); }
}
window.initializeDrag = initializeDrag;







const SLIDESHOW_IMAGES = [
    'imgs/feed/gabmin.jpg',
    'imgs/feed/icon.jpeg',
    'imgs/feed/1483620479423991031_229670069.jpg',
    'imgs/feed/1524922613398240955_229670069.jpg',
    'imgs/feed/1654627968603741409_229670069.jpg',
    'imgs/feed/1674197125049388611_229670069.jpg',
    'imgs/feed/1689416963116108364_229670069.jpg',
    'imgs/feed/1720610058268459586_229670069.jpg',
    'imgs/feed/1726412266549399440_229670069.jpg',
    'imgs/feed/2096018120270552890_229670069.jpg',
    'imgs/feed/2159695734637762049_229670069.jpg',
    'imgs/feed/2168410577649652325_229670069.jpg',
    'imgs/feed/2293050206761258322_229670069.jpg',
    'imgs/feed/2362782108473106694_229670069.jpg',
    'imgs/feed/2383073029299357114_229670069.jpg',
    'imgs/feed/2432312693155315138_229670069.jpg',
    'imgs/feed/2448925616640126939_229670069.jpg',
    'imgs/feed/2492410878867095122_229670069.jpg',
    'imgs/feed/2662859113753723303_229670069.jpg',
    'imgs/feed/2743286696488408378_229670069.jpg',
    'imgs/feed/2770073873754817204_229670069.jpg',
    'imgs/feed/2780994255512764384_229670069.jpg',
    'imgs/feed/2843270150327465836_229670069.jpg',
    'imgs/feed/2882826697176595796_229670069.jpg',
    'imgs/feed/2917234270810324686_229670069.jpg',
    'imgs/feed/2948206959959115735_229670069_1.jpg',
    'imgs/feed/2954954501087138821_229670069_1.jpg',
    'imgs/feed/3008520498268011937_229670069.jpg',
    'imgs/feed/3463858598439963487_229670069.jpg',
    'imgs/feed/3471666579232484651_229670069.jpg',
    'imgs/feed/3479649688154517773_229670069.jpg',
    'imgs/feed/3479649688406064191_229670069.jpg',
    'imgs/feed/351458387_603312831770766_8700257408493077192_n_17992145362876247.png',
    'imgs/feed/352813613_1778060222614022_3453599044081414371_n_17976573269112644.png',
    'imgs/feed/359676570_1281671176051603_6240681789574852749_n_17844844440017402.png',
    'imgs/feed/409224427_374549895085404_8735905788697766129_n_17977704635479745.png',
    'imgs/feed/Screenshot_20260207_174513_Gallery.jpg',
    'imgs/feed/a.jpg',
    'imgs/feed/buzi-us.JPG',
    'imgs/feed/carnaval2025.jpg',
    'imgs/feed/gabmin.jpg',
    'imgs/feed/mcrshow1.jpg',
    'imgs/feed/mcrshow2.jpg',
    'imgs/feed/mcrshow6.jpg',
    'imgs/feed/morcego.png'
];

function initializeSlideshow() {
    const slideshowArea = document.querySelector('.slideshow-area');
    if (!slideshowArea) return;

    if (window.slideshowInterval) clearInterval(window.slideshowInterval);
    if (window.slideshowTimeout) clearTimeout(window.slideshowTimeout);

    const shuffle = (items) => {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    };

    const shuffled = shuffle([...new Set(SLIDESHOW_IMAGES)]);

    slideshowArea.innerHTML = shuffled
        .map(src => `<img src="${src}" loading="lazy" alt="">`)
        .join('');

    let slides = Array.from(slideshowArea.querySelectorAll('img'));

    slides.forEach(img => {
        img.addEventListener('error', () => {
            console.warn('[slideshow] error:', img.src);
            img.remove();
            slides = slides.filter(s => s !== img);
            if (!slides.length) {
                slideshowArea.innerHTML = '<p style="color:#888; font-size:0.8em; text-align:center; padding:1rem;">error</p>';
            }
        });
    });

    let activeSlide = null;

    function showRandomSlide() {
        if (!slides.length) {
            window.slideshowTimeout = setTimeout(showRandomSlide, 2000);
            return;
        }
        const availableSlides = slides.filter(s => s !== activeSlide);
        const slide = availableSlides[Math.floor(Math.random() * availableSlides.length)] || slides[0];
        if (activeSlide && activeSlide !== slide) activeSlide.classList.remove('active');
        slide.classList.add('active');
        activeSlide = slide;
        window.slideshowTimeout = setTimeout(showRandomSlide, 2000);
    }

    showRandomSlide();
}
window.initializeSlideshow = initializeSlideshow;



















document.addEventListener('click', function (event) {
    try {
        const botao = event.target.closest('.portfolioNavigation');
        if (!botao) return;

        event.preventDefault();
        event.stopPropagation();

        const idDaPagina = botao.dataset.page;
        const pagina = document.getElementById(idDaPagina);
        if (!pagina) return;

        // desliga todas as abas e páginas, depois liga só a que foi clicada
        document.querySelectorAll('.portfolioPage').forEach(function (outraPagina) {
            outraPagina.classList.remove('is-active');
        });
        document.querySelectorAll('.portfolioNavigation').forEach(function (outroBotao) {
            outroBotao.classList.remove('is-active');
        });

        pagina.classList.add('is-active');
        botao.classList.add('is-active');
    } catch (error) {
        console.error('[portfolioNavigation]', error);
    }
});



(function () {
    'use strict';
    const LASTFM_USERNAME = 'minkurosu';
    const LASTFM_API_KEY = 'a2ef624a3dff8ec934580b0577d18cb5';

    async function fetchLastFmTrack() {
        try {
            const cell = document.getElementById('lastfm-song-cell');
            if (!cell) return;
            const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (data.recenttracks?.track?.length > 0) {
                const track = data.recenttracks.track[0];
                const song = track.name;
                const artist = track.artist['#text'];
                const link = track.url;
                cell.innerHTML = `<a href="${link}" target="_blank">${song.toLowerCase()} - ${artist.toLowerCase()}</a>`;
            } else {
                cell.textContent = 'no recent tracks.';
            }
        } catch (err) {
            console.error('[last.fm]', err);
            const cell = document.getElementById('lastfm-song-cell');
            if (cell) cell.textContent = 'error.';
        }
    }

    window.inicializarLastFmWidget = function () {
        setTimeout(fetchLastFmTrack, 100);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.inicializarLastFmWidget());
    } else {
        window.inicializarLastFmWidget();
    }
})();


function initGtObserver() {
    try {
        if (!document.body) return;
        const gtObserver = new MutationObserver(() => {
            const banner = document.querySelector('.goog-te-banner-frame');
            if (banner) banner.style.setProperty('display', 'none', 'important');
            if (document.body.style.top && document.body.style.top !== '0px') {
                document.body.style.setProperty('top', '0', 'important');
            }
        });
        gtObserver.observe(document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['style']
        });
    } catch (e) { console.error('[gt]', e); }
}

function initRouter() {
    const HOME = 'home';
    const ALIASES = {
        
        'comissions': 'commission',
        'commissions': 'commission',
    };

    const container = document.getElementById('container');
    if (!container) return;

    const cache = new Map();
    let controller = null;

    const resolve = name => ALIASES[name] || name;
    const urlFor = name => (name === HOME ? '/' : '/' + name);

    function loadPage(name, pushState) {
        name = resolve(name);

        if (controller) controller.abort();
        controller = new AbortController();

        const promise = cache.has(name)
            ? Promise.resolve(cache.get(name))
            : fetch(name + '.html', { signal: controller.signal })
                .then(r => {
                    if (!r.ok) throw new Error(r.statusText);
                    return r.text();
                })
                .then(html => {
                    cache.set(name, html);
                    return html;
                });

        promise.then(html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');

         
            
            let corpo = null;
            const principal = doc.querySelector('#containerprincipal');
            const interno = doc.querySelector('#container');

            if (principal && principal.innerHTML.trim()) corpo = principal;
            else if (interno) corpo = interno;
            else if (doc.body) corpo = doc.body;

          
            
            const estilos = Array.from(doc.querySelectorAll('head style'))
                .filter(s => !s.hasAttribute('data-standalone'))
                .map(s => s.outerHTML)
                .join('');

            container.innerHTML = estilos + (corpo ? corpo.innerHTML : '');

          
            
            container.querySelectorAll('script').forEach(old => {
                
                
                if (old.src && /(^|\/)script\.js(\?|$)/.test(old.getAttribute('src'))) {
                    old.remove();
                    return;
                }

                const novo = document.createElement('script');
                for (let i = 0; i < old.attributes.length; i++) {
                    const attr = old.attributes[i];
                    novo.setAttribute(attr.name, attr.value);
                }
                if (old.src) novo.async = false;     
                
                else novo.textContent = old.textContent;

                old.remove();
                document.body.appendChild(novo);
            });


            document.querySelectorAll('.nav-link').forEach(l => {
                l.classList.toggle('active', resolve(l.getAttribute('data-page')) === name);
            });


            [initCarrossel, initializeDrag, initializeSlideshow].forEach(fn => {
                try { fn(); } catch (e) { console.error('[pos-load] ' + fn.name, e); }
            });

            if (typeof window.markVisit === 'function') window.markVisit(name);
            if (pushState) history.pushState({ page: name }, '', urlFor(name));
        }).catch(err => {
            if (err.name === 'AbortError') return;
            console.error('[router] erro:', err);
            container.innerHTML = '<p style="text-align:center;color:#888;">erro ao carregar</p>';
        });
    }

    window.navigateTo = name => loadPage(name, true);

    document.addEventListener('click', function (e) {
        const link = e.target.closest('[data-page]');
        if (!link) return;
        
        
        if (link.classList.contains('portfolioNavigation')) return;
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) loadPage(page, true);
    });

    window.addEventListener('popstate', function (e) {
        loadPage((e.state && e.state.page) || HOME, false);
    });

    history.replaceState({ page: HOME }, '', urlFor(HOME));
    console.log('[router] iniciado');
    loadPage(HOME, false);
}







function initAll() {

    [lockTheme, initRouter, initCarrossel, initializeDrag, initializeSlideshow, initGtObserver].forEach(fn => {
        try { fn(); } catch (e) { console.error('[init] ' + fn.name, e); }
    });
}
window.initCarrossel = initCarrossel;
window.initGtObserver = initGtObserver;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}

})();