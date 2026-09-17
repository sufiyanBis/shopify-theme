(function () {
  if (window.catalogShowroomInitialized) return;
  window.catalogShowroomInitialized = true;

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeCard = null;
  let frame = null;
  let pointerX = 0;
  let pointerY = 0;

  function findCard(target) {
    const card = target.closest('[data-product-card], .product-card-wrapper');
    return card && card.closest('[data-catalog-showroom]') ? card : null;
  }

  function resetCard(card) {
    if (!card) return;
    card.classList.remove('is-tilting');
    card.style.removeProperty('--catalog-rotate-x');
    card.style.removeProperty('--catalog-rotate-y');
  }

  function renderTilt() {
    frame = null;
    if (!activeCard) return;

    const bounds = activeCard.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (pointerX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (pointerY - bounds.top) / bounds.height));

    activeCard.style.setProperty('--catalog-rotate-x', `${((0.5 - y) * 4).toFixed(2)}deg`);
    activeCard.style.setProperty('--catalog-rotate-y', `${((x - 0.5) * 5).toFixed(2)}deg`);
  }

  document.addEventListener('pointermove', function (event) {
    if (!finePointer.matches || reducedMotion.matches) return;

    const card = findCard(event.target);
    if (!card) {
      resetCard(activeCard);
      activeCard = null;
      return;
    }

    if (activeCard !== card) {
      resetCard(activeCard);
      activeCard = card;
      activeCard.classList.add('is-tilting');
    }

    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frame) frame = window.requestAnimationFrame(renderTilt);
  }, { passive: true });

  document.addEventListener('pointerout', function (event) {
    if (!activeCard || activeCard.contains(event.relatedTarget)) return;
    resetCard(activeCard);
    activeCard = null;
  }, { passive: true });
})();
