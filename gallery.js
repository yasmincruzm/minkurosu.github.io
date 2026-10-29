(function () {
   
    if (window.galleryReady) return;
    window.galleryReady = true;

    const fotoAberta = () => document.querySelector('.galleryItem input:checked');

    document.addEventListener('click', function (e) {

        if (e.target.matches('.galleryItem input')) return;

        const aberta = fotoAberta();
        if (!aberta) return;

        const clicada = e.target.closest('.galleryItem');

        if (!clicada || clicada.contains(aberta)) {
            aberta.checked = false;
            e.preventDefault();  
        }
    });

    document.addEventListener('keydown', function (e) {
        const aberta = fotoAberta();
        if (e.key === 'Escape' && aberta) aberta.checked = false;
    });
})();