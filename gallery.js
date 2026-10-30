
(function () {
    if (window.galleryReady) return;
    window.galleryReady = true;

    const openItems = () => document.querySelectorAll('.galleryItem[open]');

    function closeAll() {
        openItems().forEach(function (item) { item.open = false; });
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest('a, button, .carouselArrow')) return;

        const summary = e.target.closest('.galleryItem > summary');
        const clickedItem = summary && summary.parentNode;

        if (clickedItem && !clickedItem.open) return;

        if (!openItems().length) return;
        e.preventDefault(); 
        closeAll();
    }, true);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAll();
    });

    function buildCarouselArrows(item) {
        const track = item.querySelector('.carouselTrack');
        if (!track || track.parentNode.classList.contains('carouselWrap')) return;

        const wrap = document.createElement('div');
        wrap.className = 'carouselWrap';
        track.parentNode.insertBefore(wrap, track);
        wrap.appendChild(track);

        const prevButton = document.createElement('button');
        prevButton.type = 'button';
        prevButton.className = 'carouselArrow carouselPrev';
        prevButton.setAttribute('aria-label', 'previous photo');

        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'carouselArrow carouselNext';
        nextButton.setAttribute('aria-label', 'next photo');

        wrap.insertBefore(prevButton, track);
        wrap.appendChild(nextButton);

        function updateArrows() {
            const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
            const atStart = track.scrollLeft <= 2;
            wrap.toggleAttribute('data-start', atStart);
            wrap.toggleAttribute('data-end', atEnd);
        }

        function scrollByPage(direction) {
            track.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
        }

        prevButton.addEventListener('click', function () { scrollByPage(-1); });
        nextButton.addEventListener('click', function () { scrollByPage(1); });
        track.addEventListener('scroll', updateArrows, { passive: true });
        track.addEventListener('load', updateArrows, true);
        window.addEventListener('resize', updateArrows);

        item.addEventListener('toggle', function () {
            if (item.open) {
                updateArrows();
            } else {
                track.scrollTo({ left: 0, behavior: 'instant' }); 
            }
        });

        updateArrows();
    }

    document.addEventListener('toggle', function (e) {
        const item = e.target;
        if (item.matches && item.matches('.galleryItem.carousel') && item.open) {
            buildCarouselArrows(item);
        }
    }, true);

    function init() {
        document.querySelectorAll('.galleryItem.carousel').forEach(buildCarouselArrows);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();