document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('container');
    const navLinks = document.querySelectorAll('.nav-link');

    function loadPage(pageName) {
        fetch(`${pageName}.html`)
            .then(response => {
                if (!response.ok) throw new Error(`erro ao carregar: ${response.statusText}`);
                return response.text();
            })
            .then(html => {
                // Se o HTML carregado tem seu próprio layout-with-sidebars,
                // extrai só o conteúdo do #containerprincipal interno
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const innerContainer = doc.querySelector('#containerprincipal');
                mainContainer.innerHTML = innerContainer ? innerContainer.innerHTML : html;

                mainContainer.querySelectorAll('script').forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr =>
                        newScript.setAttribute(attr.name, attr.value)
                    );
                    newScript.textContent = oldScript.src ? '' : oldScript.textContent;
                    if (oldScript.src) newScript.src = oldScript.src;
                    oldScript.remove();
                    document.body.appendChild(newScript);
                });

                if (typeof Fancybox !== 'undefined') {
                    Fancybox.bind('[data-fancybox="gallery"]', {});
                }

                if (pageName === 'aboutme' && typeof inicializarLastFmWidget === 'function') {
                    setTimeout(inicializarLastFmWidget, 300);
                }
            })
            .catch(error => {
                console.error('erro ao carregar página:', error);
                mainContainer.innerHTML = '<p>erro ao carregar a página.</p>';
            });
    }

    window.navigateTo = loadPage;

    navLinks.forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            const page = event.target.getAttribute('data-page');
            if (page) loadPage(page);
        });
    });

    loadPage('aboutme');
});