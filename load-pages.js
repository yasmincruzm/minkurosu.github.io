document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('container');
    const navLinks = document.querySelectorAll('.nav-link');

    function loadPage(pageName) {
        const fileName = `${pageName}.html`;

        fetch(fileName)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`error loading page: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                mainContainer.innerHTML = html;

                const scripts = mainContainer.querySelectorAll('script');
                console.log(` found ${scripts.length} scripts ${pageName}`);

                scripts.forEach((oldScript, index) => {
                    const newScript = document.createElement('script');

                    Array.from(oldScript.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });

                    if (oldScript.src) {
                        newScript.src = oldScript.src;
                        console.log(`  ↳ script externo ${index + 1}:`, oldScript.src);
                    }
                    else {
                        newScript.textContent = oldScript.textContent;
                        console.log(`  ↳ script inline ${index + 1}`);
                    }

                    oldScript.remove();

                    document.body.appendChild(newScript);
                });

                if (typeof Fancybox !== 'undefined') {
                    Fancybox.bind('[data-fancybox="gallery"]', {});
                }

                if (pageName === 'aboutme') {
                    setTimeout(() => {
                        if (typeof inicializarLastFmWidget === 'function') {
                            console.log('calling lastfm widget initialization...');
                            inicializarLastFmWidget();
                        } else {
                            console.log('⚠️ lastfm widget function not found');
                        }
                    }, 300);
                }

                if (pageName === 'games') {
                    console.log('initializing...');

                    setTimeout(() => {
                        if (typeof window.initGamesPage === 'function') {
                            console.log('initializing...');
                            window.initGamesPage();
                        } else {
                            console.log('initializing...');
                            const gameButtons = document.querySelectorAll('.game-button-link');
                            if (gameButtons.length > 0 && gameButtons[0].onclick === null) {
                                const gameScripts = document.querySelectorAll('script');
                                gameScripts.forEach(script => {
                                    if (script.textContent.includes('game-button-link')) {
                                        try {
                                            eval(script.textContent);
                                        } catch (e) {
                                            console.error('script error:', e);
                                        }
                                    }
                                });
                            }
                        }
                    }, 200);
                }

                console.log(`✅ page ${pageName} loaded!`);
            })
            .catch(error => {
                console.error('❌ error loading page:', error);
                mainContainer.innerHTML = '<p>error loading page.</p>';
            });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const page = event.target.getAttribute('data-page');
            if (page) {
                loadPage(page);
            }
        });
    });

    loadPage('aboutme');
});