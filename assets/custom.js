(function () {
  const WISHLIST_STORAGE_KEY = "shopify-theme-wishlist";

  function getWishlist() {
    try {
      const storedWishlist = JSON.parse(
        window.localStorage.getItem(WISHLIST_STORAGE_KEY) || "[]"
      );

      return Array.isArray(storedWishlist)
        ? storedWishlist.map(String)
        : [];
    } catch (error) {
      console.warn("Unable to read wishlist:", error);
      return [];
    }
  }

  function saveWishlist(wishlist) {
    try {
      window.localStorage.setItem(
        WISHLIST_STORAGE_KEY,
        JSON.stringify(wishlist)
      );
    } catch (error) {
      console.warn("Unable to save wishlist:", error);
    }
  }

  function updateWishlistButton(button, isWishlisted) {
    const productTitle = button.dataset.productTitle || "product";
    const heart = button.querySelector(".custom-product-card__heart");

    button.classList.toggle("is-wishlisted", isWishlisted);
    button.setAttribute("aria-pressed", String(isWishlisted));
    button.setAttribute(
      "aria-label",
      `${isWishlisted ? "Remove" : "Add"} ${productTitle} ${
        isWishlisted ? "from" : "to"
      } wishlist`
    );

    if (heart) {
      heart.textContent = isWishlisted ? "♥" : "♡";
    }
  }

  function initializeWishlist() {
    const wishlist = getWishlist();

    document.querySelectorAll("[data-wishlist]").forEach(function (button) {
      updateWishlistButton(
        button,
        wishlist.includes(String(button.dataset.productId))
      );
    });
  }

  function updateVariant(card, button) {
    const variantButtons = card.querySelectorAll("[data-variant-id]");
    const quickAddButton = card.querySelector("[data-quick-add]");
    const selectedVariantTitle = card.querySelector(
      "[data-selected-variant-title]"
    );
    const priceElement = card.querySelector("[data-product-price]");

    const variantId = button.dataset.variantId;
    const variantTitle = button.dataset.variantTitle;
    const formattedVariantPrice = button.dataset.variantPrice;

    variantButtons.forEach(function (item) {
      item.classList.remove("is-selected");
    });

    button.classList.add("is-selected");

    if (quickAddButton) {
      quickAddButton.dataset.variantId = variantId;
      quickAddButton.disabled = false;
      quickAddButton.querySelector("span:last-child").textContent =
        "Quick Add";
    }

    if (selectedVariantTitle) {
      selectedVariantTitle.textContent = variantTitle;
    }

    if (priceElement && formattedVariantPrice) {
      priceElement.textContent = formattedVariantPrice;
    }
  }


  async function quickAdd(card, button) {
    const variantId = button.dataset.variantId;
    const cartUi =
      document.querySelector("cart-notification") ||
      document.querySelector("cart-drawer");

    if (!variantId) {
      console.error("No variant selected.");
      return;
    }

    const originalHTML = button.innerHTML;

    button.disabled = true;
    button.innerHTML = "<span>Adding...</span>";

    try {
      const requestBody = {
        id: Number(variantId),
        quantity: 1
      };

      if (cartUi && typeof cartUi.getSectionsToRender === "function") {
        requestBody.sections = cartUi
          .getSectionsToRender()
          .map(function (section) {
            return section.id;
          });
        requestBody.sections_url = window.location.pathname;
      }

      const response = await fetch(
        window.Shopify.routes.root + "cart/add.js",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(function () {
          return {};
        });

        throw new Error(
          errorData.description || "Unable to add product to cart."
        );
      }

      const data = await response.json();

      if (cartUi && typeof cartUi.renderContents === "function") {
        if (typeof cartUi.setActiveElement === "function") {
          cartUi.setActiveElement(button);
        }
        cartUi.renderContents(data);
      }

      button.innerHTML = "<span>✓ Added</span>";

      setTimeout(function () {
        button.innerHTML = originalHTML;
        button.disabled = false;
      }, 1500);

    } catch (error) {
      console.error("Quick Add error:", error);

      button.innerHTML = "<span>Try Again</span>";

      setTimeout(function () {
        button.innerHTML = originalHTML;
        button.disabled = false;
      }, 1500);
    }
  }


  function toggleWishlist(button) {
    const productId = String(button.dataset.productId || "");

    if (!productId) {
      return;
    }

    const wishlist = getWishlist();
    const itemIndex = wishlist.indexOf(productId);
    const isWishlisted = itemIndex === -1;

    if (isWishlisted) {
      wishlist.push(productId);
    } else {
      wishlist.splice(itemIndex, 1);
    }

    saveWishlist(wishlist);
    updateWishlistButton(button, isWishlisted);
  }


  document.addEventListener("click", function (event) {

    /* Variant button */

    const variantButton =
      event.target.closest("[data-variant-id]");

    if (
      variantButton &&
      !variantButton.hasAttribute("data-quick-add")
    ) {
      const card =
        variantButton.closest("[data-product-card]");

      if (card && !variantButton.disabled) {
        updateVariant(card, variantButton);
      }

      return;
    }


    /* Quick Add */

    const quickAddButton =
      event.target.closest("[data-quick-add]");

    if (quickAddButton) {
      const card =
        quickAddButton.closest("[data-product-card]");

      if (card) {
        quickAdd(card, quickAddButton);
      }

      return;
    }


    /* Wishlist */

    const wishlistButton =
      event.target.closest("[data-wishlist]");

    if (wishlistButton) {
      toggleWishlist(wishlistButton);
    }

  });

  initializeWishlist();

})();
