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

<head>
<meta name='LTF_verify' content='4414502b3e1c201f0023688de06f390b' />
<meta name="description" content="personal site of @minkurosu/yasmin cruz">
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-M7PWC6DDRH"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', 'G-M7PWC6DDRH');
    </script>

    <script type="module" src="firebase-config.js"></script>
    <script src="lastfm-widget.js"></script>

    <script src="script.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js"></script>

    <script src="theme-switcher.js"></script>
    <script>NekoType = "black"</script>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script type="module" src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"></script>
    <script type="module" src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"></script>

    <script src="https://iframe.chat/scripts/main.min.js"></script>

    <script type="text/javascript">
        function googleTranslateElementInit() {
            new google.translate.TranslateElement({ pageLanguage: 'pt', layout: google.translate.TranslateElement.InlineLayout.SIMPLE }, 'google_translate_element');
        }
    </script>
    <script type="text/javascript"
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.css" />

    <script src="load-pages.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.umd.js"></script>
   

    <meta charset="UTF-8">
    <meta name="viewport" content="width=1920px, initial-scale=0.4, maximum-scale=1.0, user-scalable=yes">
    <meta property="og:image" content="imgs/site_imgs/sitethumbnail.png" />

    <link rel="stylesheet" href="emo.css" id="theme-stylesheet">
      </head>