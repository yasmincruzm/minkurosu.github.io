document.addEventListener('DOMContentLoaded', () => {
    const tracks = document.querySelectorAll('.track-inner');
    tracks.forEach(track => {
        const content = track.innerHTML;
        track.innerHTML += content;
    });
});


// Exposta globalmente para que o load-pages.js chame depois de injetar
// qualquer página que tenha elementos .draggable (ex: yaoifridge) —
// antes essa função só era chamada pelo roteador duplicado que
// removemos daqui de cima.
function initializeDrag() {
    function applyTransform(target, x, y, rotation) {
        target.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    }

    interact('.draggable')
        .draggable({
            inertia: false,
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: true
                })
            ],
            autoScroll: false,
            listeners: {
                move: function (event) {
                    const target = event.target;

                    let x = (parseFloat(target.dataset.x) || 0) + event.dx;
                    let y = (parseFloat(target.dataset.y) || 0) + event.dy;
                    const rotation = (parseFloat(target.dataset.rotation) || 0);

                    applyTransform(target, x, y, rotation);

                    target.dataset.x = x;
                    target.dataset.y = y;
                }
            }
        });

    document.querySelectorAll('.draggable').forEach(item => {
        const rotation = parseFloat(item.dataset.rotation) || 0;
        const x = parseFloat(item.dataset.x) || 0;
        const y = parseFloat(item.dataset.y) || 0;
        applyTransform(item, x, y, rotation);
    });
}
window.initializeDrag = initializeDrag;

const gtObserver = new MutationObserver(() => {
  const banner = document.querySelector('.goog-te-banner-frame');
  if (banner) {
    banner.style.setProperty('display', 'none', 'important');
  }
  if (document.body.style.top && document.body.style.top !== '0px') {
    document.body.style.setProperty('top', '0', 'important');
  }
});

gtObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });