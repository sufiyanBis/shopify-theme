(function () {
  function getParentOrigin() {
    try {
      return window.parent.location.origin;
    } catch (error) {
      return null;
    }
  }

  document.addEventListener('keydown', function (event) {
    if (window.parent === window) return;
    const parentOrigin = getParentOrigin();
    if (!parentOrigin || parentOrigin === 'null') return;

    if (event.key === 'Escape') {
      event.preventDefault();
      window.parent.postMessage({ type: 'bis:close-wheel-modal' }, parentOrigin);
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = Array.from(document.querySelectorAll(
      'summary, a[href], button:enabled, [tabindex]:not([tabindex^="-"]), input:enabled, select:enabled, textarea:enabled'
    )).filter(function (element) { return element.offsetParent !== null; });
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      window.parent.postMessage({ type: 'bis:focus-wheel-close' }, parentOrigin);
    }
  });
})();
