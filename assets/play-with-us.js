(function () {
  const STORAGE_KEY = 'bis-research:play-with-us:spin:v1';
  const ELIGIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;
  const controllers = new Set();
  let sharedSessionRecord = null;

  function getSharedRecord() {
    if (sharedSessionRecord && sharedSessionRecord.expiresAt > Date.now()) return sharedSessionRecord;
    sharedSessionRecord = null;
    return null;
  }

  function shareRecord(record, sourceController) {
    sharedSessionRecord = record;
    controllers.forEach(function (controller) {
      if (controller !== sourceController) controller.receiveRecord(record);
    });
  }

  function clearSharedRecord(record) {
    if (record && sharedSessionRecord && sharedSessionRecord.spunAt !== record.spunAt) return;
    sharedSessionRecord = null;
    controllers.forEach(function (controller) { controller.receiveClear(); });
  }

  function getBrowserStorage() {
    try {
      const testKey = `${STORAGE_KEY}:test`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function initWheel(section) {
    if (section.dataset.wheelInitialized === 'true') return;

    const wheel = section.querySelector('[data-wheel]');
    const spinButton = section.querySelector('[data-spin]');
    const result = section.querySelector('[data-result]');
    const countdown = section.querySelector('[data-countdown]');
    const eligibilityNote = section.querySelector('[data-eligibility-note]');

    if (!wheel || !spinButton || !result || !countdown || !eligibilityNote) return;
    section.dataset.wheelInitialized = 'true';

    const prizes = [
      { id: 'five', label: '5% OFF', code: (section.dataset.discount5 || '').trim(), weight: 40 },
      { id: 'ten', label: '10% OFF', code: (section.dataset.discount10 || '').trim(), weight: 30 },
      { id: 'shipping', label: 'FREE SHIPPING', code: (section.dataset.discountShipping || '').trim(), weight: 15 },
      { id: 'fifteen', label: '15% OFF', code: (section.dataset.discount15 || '').trim(), weight: 10 },
      { id: 'twenty', label: '20% OFF', code: (section.dataset.discount20 || '').trim(), weight: 5 }
    ];
    const eligiblePrizes = prizes.filter(function (prize) { return prize.code.length > 0; });
    const segmentAngle = 360 / prizes.length;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let browserStorage = getBrowserStorage();
    let isSpinning = false;
    let currentRotation = 0;
    let expiryTimer = null;
    let countdownTimer = null;
    let revealTimer = null;
    let sessionRecord = null;
    let disposed = false;
    let controller;

    function updatePersistenceMessage() {
      eligibilityNote.hidden = false;
      eligibilityNote.textContent = browserStorage
        ? section.dataset.eligibilityMessage
        : section.dataset.storageMessage;
    }

    function updateOddsDisclosure() {
      const totalWeight = eligiblePrizes.reduce(function (total, prize) { return total + prize.weight; }, 0);
      section.querySelectorAll('[data-odds-prize]').forEach(function (row) {
        const prize = eligiblePrizes.find(function (item) { return item.id === row.dataset.oddsPrize; });
        row.hidden = !prize;
        if (!prize || totalWeight === 0) return;

        const value = row.querySelector('[data-odds-value]');
        const percentage = (prize.weight / totalWeight) * 100;
        if (value) value.textContent = `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
      });
    }

    function addResultLine(className, text) {
      const line = document.createElement('div');
      line.className = className;
      line.textContent = text;
      result.appendChild(line);
      return line;
    }

    function clearTimers() {
      window.clearTimeout(expiryTimer);
      window.clearInterval(countdownTimer);
      window.clearTimeout(revealTimer);
      expiryTimer = null;
      countdownTimer = null;
      revealTimer = null;
    }

    function removeStoredRecord() {
      if (!browserStorage) return;
      try {
        browserStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        browserStorage = null;
        updatePersistenceMessage();
      }
    }

    function readStoredRecord() {
      if (!browserStorage) return null;

      try {
        const rawRecord = browserStorage.getItem(STORAGE_KEY);
        if (!rawRecord) return null;

        const record = JSON.parse(rawRecord);
        const isValid = record
          && Number.isFinite(record.spunAt)
          && Number.isFinite(record.expiresAt)
          && record.spunAt <= Date.now()
          && record.expiresAt > record.spunAt
          && record.expiresAt - record.spunAt <= ELIGIBILITY_WINDOW_MS
          && typeof record.prizeId === 'string'
          && prizes.some(function (prize) { return prize.id === record.prizeId; })
          && typeof record.label === 'string'
          && typeof record.code === 'string'
          && record.code.trim().length > 0;

        if (!isValid || record.expiresAt <= Date.now()) {
          removeStoredRecord();
          return null;
        }

        return record;
      } catch (error) {
        removeStoredRecord();
        updatePersistenceMessage();
        return null;
      }
    }

    function saveRecord(record) {
      sessionRecord = record;
      if (!browserStorage) return false;

      try {
        browserStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        return true;
      } catch (error) {
        browserStorage = null;
        updatePersistenceMessage();
        return false;
      }
    }

    function formatRemainingTime(expiresAt) {
      const totalMinutes = Math.ceil(Math.max(0, expiresAt - Date.now()) / 60000);
      if (totalMinutes <= 1) return 'less than a minute';

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const parts = [];
      if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
      return parts.join(' ');
    }

    function unlockWheel() {
      clearTimers();
      sessionRecord = null;
      countdown.hidden = true;
      countdown.textContent = '';
      result.textContent = section.dataset.initialMessage || 'Spin the wheel to reveal your prize!';
      spinButton.disabled = eligiblePrizes.length === 0;
      spinButton.textContent = section.dataset.spinLabel || 'Spin the Wheel';
      wheel.classList.add('is-restoring');
      wheel.style.transform = 'rotate(0deg)';
      currentRotation = 0;
      window.requestAnimationFrame(function () { wheel.classList.remove('is-restoring'); });

      if (eligiblePrizes.length === 0) {
        result.textContent = section.dataset.noRewardsMessage || 'Rewards are temporarily unavailable.';
      }
    }

    function showCountdown(record) {
      if (!browserStorage) {
        countdown.hidden = true;
        countdown.textContent = '';
        updatePersistenceMessage();
        expiryTimer = window.setTimeout(function () {
          clearSharedRecord(record);
        }, Math.max(0, record.expiresAt - Date.now()));
        return;
      }

      function updateCountdown() {
        if (record.expiresAt <= Date.now()) {
          unlockWheel();
          return;
        }
        const label = section.dataset.countdownLabel || 'You can spin again in';
        countdown.hidden = false;
        countdown.textContent = `${label} ${formatRemainingTime(record.expiresAt)}.`;
      }

      updateCountdown();
      countdownTimer = window.setInterval(updateCountdown, 60000);
      expiryTimer = window.setTimeout(function () {
        removeStoredRecord();
        clearSharedRecord(record);
      }, Math.max(0, record.expiresAt - Date.now()));
    }

    function createApplyLink(code) {
      const applyLink = document.createElement('a');
      applyLink.className = 'play-with-us__apply';
      applyLink.href = `/discount/${encodeURIComponent(code)}?redirect=/cart`;
      applyLink.target = '_top';
      applyLink.textContent = section.dataset.applyLabel || 'Apply to cart';
      return applyLink;
    }

    function showResult(record) {
      result.replaceChildren();
      addResultLine('play-with-us__result-title', 'Congratulations!');
      const prizeLine = addResultLine('play-with-us__result-prize', 'You won ');
      const prizeName = document.createElement('strong');
      prizeName.textContent = record.label;
      prizeLine.appendChild(prizeName);

      const codeLine = addResultLine('play-with-us__result-code', 'Discount code: ');
      const codeText = document.createElement('strong');
      codeText.textContent = record.code;
      codeLine.appendChild(codeText);

      const applyLink = createApplyLink(record.code);
      result.appendChild(applyLink);
      return applyLink;
    }

    function positionWheel(prizeId, animate) {
      const prizeIndex = prizes.findIndex(function (prize) { return prize.id === prizeId; });
      if (prizeIndex < 0) return;

      const segmentCenter = (prizeIndex * segmentAngle) + (segmentAngle / 2);
      const targetRotation = 360 - segmentCenter;

      if (!animate) {
        currentRotation = targetRotation;
        wheel.classList.add('is-restoring');
        wheel.style.transform = `rotate(${currentRotation}deg)`;
        window.requestAnimationFrame(function () { wheel.classList.remove('is-restoring'); });
        return;
      }

      const normalizedRotation = ((currentRotation % 360) + 360) % 360;
      const rotationToTarget = (targetRotation - normalizedRotation + 360) % 360;
      currentRotation += (5 * 360) + rotationToTarget;
      wheel.style.transform = `rotate(${currentRotation}deg)`;
    }

    function selectWeightedPrize() {
      const totalWeight = eligiblePrizes.reduce(function (total, prize) { return total + prize.weight; }, 0);
      let selection = Math.random() * totalWeight;

      for (const prize of eligiblePrizes) {
        selection -= prize.weight;
        if (selection < 0) return prize;
      }
      return eligiblePrizes[eligiblePrizes.length - 1];
    }

    function lockWithRecord(record, restoreWheel) {
      clearTimers();
      sessionRecord = record;
      isSpinning = false;
      spinButton.disabled = true;
      spinButton.textContent = section.dataset.spinLabel || 'Spin the Wheel';
      positionWheel(record.prizeId, !restoreWheel);
      showResult(record);
      showCountdown(record);
    }

    function spinWheel() {
      if (isSpinning || sessionRecord || eligiblePrizes.length === 0) return;

      const existingRecord = readStoredRecord() || getSharedRecord();
      if (existingRecord) {
        lockWithRecord(existingRecord, true);
        shareRecord(existingRecord, controller);
        return;
      }

      isSpinning = true;
      spinButton.disabled = true;
      result.setAttribute('aria-busy', 'true');
      result.textContent = 'Spinning…';
      countdown.hidden = true;

      const prize = selectWeightedPrize();
      const spunAt = Date.now();
      const record = {
        spunAt: spunAt,
        expiresAt: spunAt + ELIGIBILITY_WINDOW_MS,
        prizeId: prize.id,
        label: prize.label,
        code: prize.code
      };
      const persisted = saveRecord(record);
      shareRecord(record, controller);
      positionWheel(prize.id, true);

      revealTimer = window.setTimeout(function () {
        revealTimer = null;
        if (disposed || !section.isConnected) return;
        const applyLink = showResult(record);
        result.removeAttribute('aria-busy');
        isSpinning = false;
        spinButton.textContent = section.dataset.spinLabel || 'Spin the Wheel';
        showCountdown(record);
        if (!persisted) browserStorage = null;
        applyLink.focus({ preventScroll: true });
      }, reducedMotion.matches ? 50 : 5200);
    }

    function restoreEligibility() {
      clearTimers();
      const record = readStoredRecord() || getSharedRecord();
      if (record) {
        lockWithRecord(record, true);
        shareRecord(record, controller);
      } else {
        unlockWheel();
      }
    }

    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === null) {
        clearSharedRecord();
      } else {
        restoreEligibility();
      }
    }

    controller = {
      receiveRecord: function (record) {
        if (disposed) return;
        if (isSpinning && sessionRecord && sessionRecord.spunAt === record.spunAt) return;
        lockWithRecord(record, true);
      },
      receiveClear: function () {
        if (!disposed) unlockWheel();
      }
    };
    controllers.add(controller);
    spinButton.addEventListener('click', spinWheel);
    window.addEventListener('storage', onStorage);
    section._playWithUsCleanup = function () {
      disposed = true;
      clearTimers();
      controllers.delete(controller);
      window.removeEventListener('storage', onStorage);
    };
    updateOddsDisclosure();
    updatePersistenceMessage();
    restoreEligibility();
  }

  function initializeWithin(root) {
    if (root.matches && root.matches('.play-with-us')) initWheel(root);
    root.querySelectorAll('.play-with-us').forEach(initWheel);
  }

  function initialize() { initializeWithin(document); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initializeWithin(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (event.target.matches && event.target.matches('.play-with-us') && event.target._playWithUsCleanup) {
      event.target._playWithUsCleanup();
    }
    event.target.querySelectorAll('.play-with-us').forEach(function (section) {
      if (section._playWithUsCleanup) section._playWithUsCleanup();
    });
  });
})();
