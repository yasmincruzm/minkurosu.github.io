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


    function notifySession(pageName) {
        if (typeof window.markVisit === 'function') {
            window.markVisit(pageName);
        } else {
            let fired = false;
            const handler = () => {
                fired = true;
                window.markVisit(pageName);
            };
            window.addEventListener('app:ready', handler, { once: true });
            setTimeout(() => {
                if (fired) return;
                window.removeEventListener('app:ready', handler);
                if (typeof window.markVisit === 'function') {
                    window.markVisit(pageName);
                }
            }, 800);
        }
    }

    const loadedExternalScripts = new Set(
        Array.from(document.scripts).map(s => s.src).filter(Boolean)
    );

    function rehydrateScripts(container) {
        container.querySelectorAll('script').forEach(old => {
            const src = old.getAttribute('src');

          
            if (src && loadedExternalScripts.has(new URL(src, location.href).href)) {
                old.remove();
                return;
            }

            const neo = document.createElement('script');
            Array.from(old.attributes).forEach(a => neo.setAttribute(a.name, a.value));
            if (!old.src) {
                neo.textContent = old.textContent;
            } else {
                loadedExternalScripts.add(new URL(old.src, location.href).href);
            }
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

    
    const IFRAME_PAGES = ['games'];

    function fixViewport(pageName) {
        const vp = document.querySelector('meta[name="viewport"]');
        if (!vp) return;
        if (IFRAME_PAGES.includes(pageName)) {
            vp.setAttribute('content', 'width=device-width, initial-scale=1.0, shrink-to-fit=no');
        } else {
            vp.setAttribute('content',
                'width=1920px, initial-scale=0.4, maximum-scale=3.0, user-scalable=yes');
        }
    }


    
    const pageCache = new Map();

    let currentFetchController = null;

    function loadPage(pageName, pushState = false) {
        if (currentFetchController) currentFetchController.abort();

        const cached = pageCache.get(pageName);
        const fetchPromise = cached
            ? Promise.resolve(cached)
            : (() => {
                currentFetchController = new AbortController();
                return fetch(`${pageName}.html`, { signal: currentFetchController.signal })
                    .then(r => {
                        if (!r.ok) throw new Error(r.statusText);
                        return r.text();
                    })
                    .then(html => {
                        pageCache.set(pageName, html);
                        return html;
                    });
            })();

        fetchPromise
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');

                const thoughts = doc.querySelector('#thoughts-root');
                const inner = doc.querySelector('#containerprincipal') || doc.querySelector('#container');

                if (thoughts) {
                    const styles = Array.from(doc.querySelectorAll('style'))
                        .map(s => s.outerHTML)
                        .join('');
                    mainContainer.innerHTML = styles + thoughts.outerHTML;
                } else if (inner) {
                  
                    const styles = Array.from(doc.querySelectorAll('style'))
                        .map(s => s.outerHTML)
                        .join('');
                    mainContainer.innerHTML = styles + inner.innerHTML;
                } else {
                  
                    const styles = Array.from(doc.querySelectorAll('head style'))
                        .map(s => s.outerHTML)
                        .join('');
                    mainContainer.innerHTML = doc.body ? styles + doc.body.innerHTML : html;
                }

                fixViewport(pageName);
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

                notifySession(pageName);

                document.querySelectorAll('.nav-link').forEach(l => {
                    l.classList.toggle('active', l.getAttribute('data-page') === pageName);
                });

                if (pushState) {
                    history.pushState({ page: pageName }, '', `/${pageName}`);
                }
            })
            .catch(err => {
                if (err.name === 'AbortError') return; 
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