document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".play-with-us");

  sections.forEach((section) => {
    const wheel = section.querySelector("[data-wheel]");
    const spinButton = section.querySelector("[data-spin]");
    const resetButton = section.querySelector("[data-reset]");
    const result = section.querySelector("[data-result]");

    if (!wheel || !spinButton || !resetButton || !result) {
      return;
    }

    /*
     * IMPORTANT:
     * This order MUST match the visible wheel segments
     * from top and then clockwise:
     *
     * 1. 10% OFF
     * 2. 15% OFF
     * 3. FREE SHIPPING
     * 4. 20% OFF
     * 5. 5% OFF
     * 6. TRY AGAIN
     */
    const prizes = [
      {
        label: "10% OFF",
        code: "SPIN10"
      },
      {
        label: "15% OFF",
        code: "SPIN15"
      },
      {
        label: "FREE SHIPPING",
        code: "SPINSHIP"
      },
      {
        label: "20% OFF",
        code: "SPIN20"
      },
      {
        label: "5% OFF",
        code: "SPIN5"
      },
      {
        label: "TRY AGAIN",
        code: null
      }
    ];

    const segmentCount = prizes.length;
    const segmentAngle = 360 / segmentCount;

    let isSpinning = false;
    let currentRotation = 0;


    /* =====================================================
       SHOW RESULT
       ===================================================== */

    function showResult(prize) {

      if (prize.code) {

        result.innerHTML = `
          <div class="play-with-us__result-title">
            🎉 Congratulations!
          </div>

          <div class="play-with-us__result-prize">
            You won <strong>${prize.label}</strong>
          </div>

          <div class="play-with-us__result-code">
            Your discount code:
            <strong>${prize.code}</strong>
          </div>

          <button
            type="button"
            class="play-with-us__apply"
            data-discount="${prize.code}"
          >
            Apply Discount
          </button>
        `;

      } else if (prize.label === "FREE SHIPPING") {

        result.innerHTML = `
          <div class="play-with-us__result-title">
            🎉 Congratulations!
          </div>

          <div class="play-with-us__result-prize">
            You won <strong>FREE SHIPPING</strong>
          </div>

          <div class="play-with-us__result-code">
            Your free shipping reward has been unlocked!
          </div>
        `;

      } else {

        result.innerHTML = `
          <div class="play-with-us__result-title">
            🎡 Better luck next time!
          </div>

          <div class="play-with-us__result-prize">
            Give it another spin!
          </div>
        `;
      }
    }


    /* =====================================================
       SPIN
       ===================================================== */

    function spinWheel() {

      if (isSpinning) {
        return;
      }

      isSpinning = true;

      spinButton.disabled = true;

      resetButton.classList.remove("is-visible");

      result.innerHTML = `
        <div class="play-with-us__result-title">
          🎡 Spinning...
        </div>
      `;


      /*
       * Pick one prize.
       */
      const prizeIndex = Math.floor(
        Math.random() * segmentCount
      );

      /*
       * Each segment is 60 degrees.
       *
       * We want the CENTER of the selected segment
       * to stop directly under the pointer.
       *
       * Segment centers:
       *
       * 10% OFF        = 30°
       * 15% OFF        = 90°
       * FREE SHIPPING  = 150°
       * 20% OFF        = 210°
       * 5% OFF         = 270°
       * TRY AGAIN      = 330°
       */

      const segmentCenter =
        (prizeIndex * segmentAngle) +
        (segmentAngle / 2);


      /*
       * Move selected segment center to 0° (top).
       */
      const targetRotation =
        360 - segmentCenter;


      /*
       * Add 5 complete spins.
       */
      const fullSpins = 5 * 360;


      /*
       * Keep the wheel moving forward.
       */
      const normalizedRotation =
        ((currentRotation % 360) + 360) % 360;

      const rotationToTarget =
        (targetRotation - normalizedRotation + 360) % 360;

      currentRotation +=
        fullSpins +
        rotationToTarget;


      wheel.style.transform =
        `rotate(${currentRotation}deg)`;


      /*
       * Wait until wheel animation finishes.
       */
      setTimeout(() => {

        const selectedPrize =
          prizes[prizeIndex];

        showResult(selectedPrize);

        resetButton.classList.add(
          "is-visible"
        );

        isSpinning = false;

      }, 5200);
    }


    /* =====================================================
       RESET
       ===================================================== */

    function resetWheel() {

      if (isSpinning) {
        return;
      }

      result.innerHTML = `
        Spin the wheel to reveal your prize!
      `;

      resetButton.classList.remove(
        "is-visible"
      );

      spinButton.disabled = false;
    }


    /* =====================================================
       APPLY DISCOUNT
       ===================================================== */

    function applyDiscount(code) {

      if (!code) {
        return;
      }

      const discountUrl =
        `/discount/${encodeURIComponent(code)}?redirect=/cart`;

      window.location.href = discountUrl;
    }


    /* =====================================================
       BUTTON EVENTS
       ===================================================== */

    spinButton.addEventListener(
      "click",
      spinWheel
    );


    resetButton.addEventListener(
      "click",
      resetWheel
    );


    /*
     * Apply button is created dynamically,
     * so we listen from the result container.
     */
    result.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            ".play-with-us__apply"
          );

        if (!button) {
          return;
        }

        const code =
          button.dataset.discount;

        applyDiscount(code);
      }
    );


    /* =====================================================
       INITIAL STATE
       ===================================================== */

    result.innerHTML = `
      Spin the wheel to reveal your prize!
    `;

    spinButton.disabled = false;
  });
});
