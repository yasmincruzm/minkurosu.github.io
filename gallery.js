/* ============================================================
   gallery.js — só o que o CSS não consegue fazer sozinho:
   FECHAR a foto aberta.
   (Um radio marcado não desmarca sozinho quando você clica nele
   de novo, nem quando você clica fora.)

   Abrir e trocar de foto é tudo CSS, veja o gallery.css.
   ============================================================ */
(function () {
    // o roteador do site pode carregar esse arquivo de novo a cada página:
    // se já rodou, não registra os listeners outra vez
    if (window.__galleryReady) return;
    window.__galleryReady = true;

    const fotoAberta = () => document.querySelector('.gallery-item input:checked');

    document.addEventListener('click', function (e) {
        // Ao clicar num label, o navegador dispara um segundo clique, direto no
        // radio. Esse a gente ignora, senão fecharia a foto que acabou de abrir.
        if (e.target.matches('.gallery-item input')) return;

        const aberta = fotoAberta();
        if (!aberta) return;

        const clicada = e.target.closest('.gallery-item');

        // clicou fora das fotos, ou na que já está aberta: fecha.
        // (se clicou em OUTRA foto, não faz nada: o CSS troca sozinho)
        if (!clicada || clicada.contains(aberta)) {
            aberta.checked = false;
            e.preventDefault();   // sem isso o label marcaria o radio de novo
        }
    });

    document.addEventListener('keydown', function (e) {
        const aberta = fotoAberta();
        if (e.key === 'Escape' && aberta) aberta.checked = false;
    });
})();
