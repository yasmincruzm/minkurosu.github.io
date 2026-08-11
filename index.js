
window.initializeSlideshow = function initializeSlideshow() {
  const slideshowArea = document.querySelector('.slideshow-area');
  if (!slideshowArea) return;

  if (window.slideshowInterval) {
    clearInterval(window.slideshowInterval);
    window.slideshowInterval = null;
  }
  if (window.slideshowTimeout) {
    clearTimeout(window.slideshowTimeout);
    window.slideshowTimeout = null;
  }

  const ALL_IMAGES = [
    'imgs/feed/359676570_1281671176051603_6240681789574852749_n_17844844440017402.png',
    'imgs/feed/gabmin.jpg',
    'imgs/feed/icon.jpeg',
    'imgs/feed/1483620479423991031_229670069.jpg',
    'imgs/feed/1524922613398240955_229670069.jpg',
    'imgs/feed/1654627968603741409_229670069.jpg',
    'imgs/feed/1674197125049388611_229670069.jpg',
    'imgs/feed/1682171255140996947_229670069.jpg',
    'imgs/feed/1689416963116108364_229670069.jpg',
    'imgs/feed/1711156366234358660_229670069.jpg',
    'imgs/feed/1720610058268459586_229670069.jpg',
    'imgs/feed/1726412266549399440_229670069.jpg',
    'imgs/feed/2096018120270552890_229670069.jpg',
    'imgs/feed/2096824735445945639_229670069.jpg',
    'imgs/feed/2118412932915395776_229670069.jpg',
    'imgs/feed/2159695734637762049_229670069.jpg',
    'imgs/feed/2168410577649652325_229670069.jpg',
    'imgs/feed/2177182701927452542_229670069.jpg',
    'imgs/feed/2293050206761258322_229670069.jpg',
    'imgs/feed/2362782108473106694_229670069.jpg',
    'imgs/feed/2383073029299357114_229670069.jpg',
    'imgs/feed/2392479720474162475_229670069.jpg',
    'imgs/feed/2432312693155315138_229670069.jpg',
    'imgs/feed/2448925616640126939_229670069.jpg',
    'imgs/feed/2461338154342427705_229670069.jpg',
    'imgs/feed/2492410878867095122_229670069.jpg',
    'imgs/feed/2662859113753723303_229670069.jpg',
    'imgs/feed/2711421198318608648_229670069.jpg',
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
    'imgs/feed/352742044_1277184593201910_1116441006859171930_n_18025301965554649.png',
    'imgs/feed/352813613_1778060222614022_3453599044081414371_n_17976573269112644.png',
    'imgs/feed/354690656_990819811942464_73347386362552945_n_17985432605004574.png',
    'imgs/feed/356108452_864271168461032_8828755740101118722_n_17981619872198561.png',
    'imgs/feed/359676570_1281671176051603_6240681789574852749_n_17844844440017402.png',
    'imgs/feed/409224427_374549895085404_8735905788697766129_n_17977704635479745.png',
    'imgs/feed/419032011_729156312513499_9214248630835624547_n_18055395166523540.png',
    'imgs/feed/420836652_1495135711055866_4179943012179118039_n_17902313054927649.png',
    'imgs/feed/Screenshot_20260207_174513_Gallery.jpg',
    'imgs/feed/a.jpg',
    'imgs/feed/bluehair.jpg',
    'imgs/feed/buzi-us.JPG',
    'imgs/feed/bz7.jpg',
    'imgs/feed/carnaval2025.jpg',
    'imgs/feed/gabmin.jpg',
    'imgs/feed/mcrshow1.jpg',
    'imgs/feed/mcrshow2.jpg',
    'imgs/feed/mcrshow6.jpg',
    'imgs/feed/mcrshow7.jpg',
    'imgs/feed/morcego.png',
    'imgs/feed/us.png'
  ];

  const shuffle = (items) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const shuffled = shuffle([...new Set(ALL_IMAGES)]);

  slideshowArea.innerHTML = shuffled
    .map(src => `<img src="${src}" loading="lazy" alt="">`)
    .join('');

  let slides = Array.from(slideshowArea.querySelectorAll('img'));

  slides.forEach(img => {
    img.addEventListener('error', () => {
      console.warn('[slideshow] falhou ao carregar:', img.src);
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

    const availableSlides = slides.filter(slide => slide !== activeSlide);
    const slide = availableSlides[Math.floor(Math.random() * availableSlides.length)] || slides[0];

    if (activeSlide && activeSlide !== slide) {
      activeSlide.classList.remove('active');
    }
    slide.classList.add('active');
    activeSlide = slide;

    window.slideshowTimeout = setTimeout(showRandomSlide, 2000);
  }

  showRandomSlide();
};
