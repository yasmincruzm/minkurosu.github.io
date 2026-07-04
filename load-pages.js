
(function restoreDeepLink() {
    const redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect) {
        const current = location.pathname + location.search + location.hash;
        if (redirect !== current) {
            history.replaceState(null, '', redirect);
        }
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('container');
    if (!mainContainer) return;


    function callTracker(pageName) {
        if (typeof window.trackPage === 'function') {
            window.trackPage(pageName);
        } else {
            const handler = () => window.trackPage(pageName);
            window.addEventListener('tracker:ready', handler, { once: true });
            setTimeout(() => {
                if (typeof window.trackPage === 'function') {
                    window.removeEventListener('tracker:ready', handler);
                    window.trackPage(pageName);
                }
            }, 800);
        }
    }

    function rehydrateScripts(container) {
        container.querySelectorAll('script').forEach(old => {
            const neo = document.createElement('script');
            Array.from(old.attributes).forEach(a => neo.setAttribute(a.name, a.value));
            if (!old.src) neo.textContent = old.textContent;
            old.remove();
            document.body.appendChild(neo);
        });
    }

    function initSlideshowIfNeeded() {
        const area = mainContainer.querySelector('.slideshow-area');
        if (!area) return;
        const imgs = area.querySelectorAll('img');
        if (!imgs.length) return;
        let idx = 0;
        imgs.forEach(i => i.classList.remove('active'));
        imgs[0].classList.add('active');
        clearInterval(window.slideshowInterval);
        window.slideshowInterval = setInterval(() => {
            imgs[idx].classList.remove('active');
            idx = (idx + 1) % imgs.length;
            imgs[idx].classList.add('active');
        }, 4000);
    }

    function fixViewport() {
        const vp = document.querySelector('meta[name="viewport"]');
        if (vp) vp.setAttribute('content',
            'width=1920px, initial-scale=0.4, maximum-scale=3.0, user-scalable=yes');
    }


    function loadPage(pageName, pushState = false) {
        fetch(`${pageName}.html`)
            .then(r => {
                if (!r.ok) throw new Error(r.statusText);
                return r.text();
            })
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');

                const thoughts = doc.querySelector('#thoughts-root');
                const inner = doc.querySelector('#containerprincipal') || doc.querySelector('#container');

                if (thoughts) {
                    const styles = Array.from(doc.querySelectorAll('style'))
                        .map(s => s.outerHTML)
                        .join('');
                    mainContainer.innerHTML = styles + thoughts.outerHTML;
                } else {
                    mainContainer.innerHTML = inner ? inner.innerHTML : html;
                }

                fixViewport();
                rehydrateScripts(mainContainer);

                setTimeout(() => {
                    initSlideshowIfNeeded();

                    if (typeof Fancybox !== 'undefined') {
                        Fancybox.bind('[data-fancybox="gallery"]', {});
                    }

                    if (typeof inicializarLastFmWidget === 'function') {
                        inicializarLastFmWidget();
                    }
                }, 200);

                callTracker(pageName);

                document.querySelectorAll('.nav-link').forEach(l => {
                    l.classList.toggle('active', l.getAttribute('data-page') === pageName);
                });

                if (pushState) {
                    history.pushState({ page: pageName }, '', `/${pageName}`);
                }
            })
            .catch(err => {
                console.error('erro ao carregar página:', err);
                mainContainer.innerHTML = '<p>erro ao carregar. tente novamente.</p>';
            });
    }

    window.navigateTo = (pageName) => loadPage(pageName, true);

    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            if (page) loadPage(page, true);
        });
    });

    window.addEventListener('popstate', e => {
        const page = e.state?.page || 'aboutme';
        loadPage(page, false);
    });

    const initialPage = (() => {
        const path = location.pathname.replace(/^\//, '').replace(/\.html$/, '');
        return path && path !== 'index' ? path : 'aboutme';
    })();

    history.replaceState({ page: initialPage }, '', `/${initialPage}`);
    loadPage(initialPage, false);
});