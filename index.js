document.addEventListener('DOMContentLoaded', function () {
  const mainContainer = document.getElementById('container');
  const dynamicLinks = document.querySelectorAll('[data-page], .nav-link[href="#"][onclick="history.back(); return false;"]');

  function initializeSlideshow() {
    const slideshowArea = document.querySelector('.slideshow-area');
    if (!slideshowArea) return;

    const images = slideshowArea.querySelectorAll('img');
    if (images.length === 0) return;

    let currentIndex = 0;

    images.forEach(img => img.classList.remove('active'));
    images[0].classList.add('active');

    if (window.slideshowInterval) {
      clearInterval(window.slideshowInterval);
    }

    function nextSlide() {
      images[currentIndex].classList.remove('active');
      currentIndex = (currentIndex + 1) % images.length;
      images[currentIndex].classList.add('active');
    }

    window.slideshowInterval = setInterval(nextSlide, 4000);
  }

  function fixViewport() {
    let vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      vp.setAttribute('content', 'width=1920px, initial-scale=0.4, maximum-scale=3.0, user-scalable=yes');
    }
  }

  function loadContent(pageName) {
    const url = `${pageName}.html`;
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('error loading content: ' + response.statusText);
        }
        return response.text();
      })
      .then(data => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, 'text/html');
        const contentToLoad = doc.querySelector('#container');

        if (contentToLoad) {
          mainContainer.innerHTML = contentToLoad.innerHTML;

          fixViewport();

          setTimeout(() => {
            initializeSlideshow();

            if (typeof Fancybox !== 'undefined') {
              // Hash: false evita que o fancybox empurre um estado no histórico
              // do navegador — era isso que fazia voltar pra página principal
              // depois de fechar o visualizador.
              Fancybox.bind('[data-fancybox="gallery"]', { Hash: false });
              console.log('✅ fancybox initialized in index.js');
            }

            if (typeof inicializarLastFmWidget === 'function') {
              console.log('🎵 calling lastfm widget initialization...');
              inicializarLastFmWidget();
            }
          }, 200);

        } else {
          mainContainer.innerHTML = '<p>content not found. please click the button again to try reloading the content.</p>';
        }
      })
      .catch(error => {
        console.error('error loading content:', error);
        mainContainer.innerHTML = '<p>an error occurred while loading the page. please click the button again to try reloading the content.</p>';
      });
  }

  function handleNavLinkClick(event) {
    event.preventDefault();

    if (this.getAttribute('onclick') && this.getAttribute('onclick').includes('history.back')) {
      history.back();
      return;
    }

    const page = this.getAttribute('data-page');
    if (page) {
      history.pushState({ page: page }, '', `${page}.html`);
      loadContent(page);
    }

    const allLinks = document.querySelectorAll('.nav-link');
    allLinks.forEach(link => link.classList.remove('active'));
    this.classList.add('active');
  }

  dynamicLinks.forEach(link => link.addEventListener('click', handleNavLinkClick));

  window.addEventListener('popstate', function (event) {
    const state = event.state;
    if (state && state.page) {
      loadContent(state.page);
    } else {
      loadContent('aboutme');
    }
  });

  loadContent('aboutme');
});