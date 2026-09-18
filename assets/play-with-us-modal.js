(function () {
  function initializeModal() {
    const modal = document.querySelector('[data-play-with-us-modal]');
    if (!modal || modal.dataset.initialized === 'true') return;
    modal.dataset.initialized = 'true';

    const dialog = modal.querySelector('[role="dialog"]');
    const closeButton = modal.querySelector('.play-modal__close');
    const frame = modal.querySelector('[data-play-modal-frame]');
    const stage = modal.querySelector('[data-play-modal-stage]');
    const statusText = modal.querySelector('[data-play-modal-status-text]');
    let activeTrigger = null;
    let previousFocusContainer = null;
    let loadTimer = null;
    let loadState = 'idle';
    let loadSequence = 0;
    let loadController = null;
    let escapeKeyupTimer = null;
    let escapeKeyupHandler = null;

    function clearEscapeKeyupSuppression() {
      window.clearTimeout(escapeKeyupTimer);
      if (escapeKeyupHandler) document.removeEventListener('keyup', escapeKeyupHandler, true);
      escapeKeyupTimer = null;
      escapeKeyupHandler = null;
    }

    function suppressNextEscapeKeyup() {
      clearEscapeKeyupSuppression();
      escapeKeyupHandler = function (event) {
        if (event.key !== 'Escape' && event.code !== 'Escape') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        clearEscapeKeyupSuppression();
      };
      document.addEventListener('keyup', escapeKeyupHandler, true);
      escapeKeyupTimer = window.setTimeout(clearEscapeKeyupSuppression, 1000);
    }

    function restorePreviousFocusTrap() {
      if (
        previousFocusContainer
        && previousFocusContainer.isConnected
        && previousFocusContainer.classList.contains('active')
        && typeof window.trapFocus === 'function'
      ) {
        window.trapFocus(previousFocusContainer, activeTrigger && activeTrigger.isConnected ? activeTrigger : previousFocusContainer);
        return;
      }

      if (activeTrigger && activeTrigger.isConnected) activeTrigger.focus();
    }

    function closeModal(options) {
      if (modal.hidden) return;
      if (options?.suppressEscapeKeyup) suppressNextEscapeKeyup();
      if (loadState === 'fetching' || loadState === 'embedding') cancelPendingLoad();
      modal.hidden = true;
      document.body.classList.remove('play-modal-open');
      if (typeof window.removeTrapFocus === 'function') window.removeTrapFocus();
      restorePreviousFocusTrap();
    }

    function showLoadError() {
      loadState = 'error';
      window.clearTimeout(loadTimer);
      loadTimer = null;
      stage.classList.remove('is-loaded');
      stage.classList.add('is-error');
      statusText.textContent = window.playWithUsModalStrings?.error || 'The wheel is taking longer than expected.';
    }

    function cancelPendingLoad() {
      loadSequence += 1;
      if (loadController) loadController.abort();
      loadController = null;
      window.clearTimeout(loadTimer);
      loadTimer = null;

      if (loadState === 'embedding') {
        frame.removeAttribute('srcdoc');
        frame.src = 'about:blank';
      }

      loadState = 'idle';
    }

    async function loadFrame(url) {
      if (loadState === 'loaded' || loadState === 'fetching' || loadState === 'embedding') return;

      let requestUrl;
      try {
        requestUrl = new URL(url || frame.dataset.src, window.location.href);
        if (requestUrl.origin !== window.location.origin) throw new Error('Wheel URL must be same-origin');
      } catch (error) {
        showLoadError();
        return;
      }

      const sequence = ++loadSequence;
      loadState = 'fetching';
      stage.classList.remove('is-error');
      stage.classList.remove('is-loaded');
      statusText.textContent = window.playWithUsModalStrings?.loading || 'Preparing your wheel…';
      loadController = typeof AbortController === 'function' ? new AbortController() : null;
      loadTimer = window.setTimeout(function () {
        if (sequence !== loadSequence || loadState === 'loaded') return;
        if (loadController) loadController.abort();
        loadController = null;
        showLoadError();
      }, 15000);

      try {
        const response = await window.fetch(requestUrl.href, {
          credentials: 'same-origin',
          headers: { Accept: 'text/html' },
          signal: loadController?.signal
        });
        if (!response.ok) throw new Error(`Wheel request failed with status ${response.status}`);
        const html = await response.text();
        if (sequence !== loadSequence || modal.hidden) return;

        loadController = null;
        loadState = 'embedding';
        frame.removeAttribute('src');
        frame.srcdoc = html;
      } catch (error) {
        if (sequence !== loadSequence || error?.name === 'AbortError') return;
        loadController = null;
        showLoadError();
      }
    }

    function openModal(trigger) {
      activeTrigger = trigger;
      previousFocusContainer = trigger.closest('cart-drawer.active');
      if (!previousFocusContainer) {
        const notification = trigger.closest('cart-notification');
        previousFocusContainer = notification ? notification.querySelector('#cart-notification') : null;
      }
      modal.hidden = false;
      document.body.classList.add('play-modal-open');
      loadFrame(trigger.getAttribute('href'));

      if (typeof window.trapFocus === 'function') {
        window.trapFocus(dialog, closeButton);
      } else {
        closeButton.focus();
      }
    }

    frame.addEventListener('load', function () {
      if (loadState !== 'embedding') return;
      try {
        if (frame.contentWindow.location.href !== 'about:srcdoc') return;
      } catch (error) {
        return;
      }
      loadState = 'loaded';
      window.clearTimeout(loadTimer);
      loadTimer = null;
      stage.classList.remove('is-error');
      stage.classList.add('is-loaded');
    });

    document.addEventListener('click', function (event) {
      const trigger = event.target.closest('[data-play-with-us-modal-trigger]');
      if (trigger && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openModal(trigger);
      }
    });

    modal.addEventListener('click', function (event) {
      if (!event.target.closest('[data-play-modal-close]')) return;
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    });

    document.addEventListener('keydown', function (event) {
      if (!modal.hidden && (event.key === 'Escape' || event.code === 'Escape')) {
        event.preventDefault();
        closeModal({ suppressEscapeKeyup: true });
      }
    });

    window.addEventListener('message', function (event) {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'bis:close-wheel-modal') closeModal({ suppressEscapeKeyup: true });
      if (event.data?.type === 'bis:focus-wheel-close') closeButton.focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModal, { once: true });
  } else {
    initializeModal();
  }
})();
