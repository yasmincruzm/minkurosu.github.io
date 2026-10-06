
function initializeDrag() {
    function applyTransform(target, x, y, rotation) {
        target.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    }