
(function () {
   
    if (window.galleryReady) return;
    window.galleryReady = true;

    const fotoAberta = () => document.querySelector('.gallery-item input:checked');

    document.addEventListener('click', function (e) {

        if (e.target.matches('.gallery-item input')) return;

        const aberta = fotoAberta();
        if (!aberta) return;

        const clicada = e.target.closest('.gallery-item');

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