/* ============================================================
   Inesa Cole ART - Gallery Page Logic
   ============================================================
   - Dynamically renders paintings from data
   - Integrates with Shopify Buy Button SDK for purchases
   - Lightbox for image viewing
   ============================================================ */

(function () {
    'use strict';

    const galleryGrid = document.getElementById('gallery-grid');
    const filterButtons = document.querySelectorAll('.filter-btn');
    let allPaintings = [];
    let shopifyClient = null;
    let shopifyUI = null;

    /* ----------------------------------------------------------
       SHOPIFY CONFIGURATION
       ----------------------------------------------------------
       To connect your Shopify Starter Plan:
       1. Go to your Shopify Admin > Sales Channels > Buy Button
       2. Create a Buy Button for each product
       3. Copy your domain and storefront access token below
       4. For each painting in admin, add the Shopify Product ID
       ---------------------------------------------------------- */
    const SHOPIFY_CONFIG = {
        domain: 'z0byzs-ha.myshopify.com',
        storefrontAccessToken: 'ab2db4a231ed99255380904ce548fb12',
        enabled: true
    };

    /**
     * Initialize the gallery page.
     */
    async function init() {
        showLoading();
        allPaintings = await loadPaintings();
        renderGallery(allPaintings);
        setupFilters();
        if (SHOPIFY_CONFIG.enabled) {
            initShopify();
        }
    }

    /**
     * Show loading state.
     */
    function showLoading() {
        galleryGrid.innerHTML = '<div class="gallery-loading">Loading paintings...</div>';
    }

    /**
     * Render painting cards into the gallery grid.
     */
    function renderGallery(paintings) {
        if (paintings.length === 0) {
            galleryGrid.innerHTML = '<div class="gallery-empty">No paintings to display at this time. Please check back soon.</div>';
            return;
        }

        galleryGrid.innerHTML = paintings.map(painting => {
            const isSold = !painting.available;
            const soldBadge = isSold ? '<div class="sold-badge">Sold</div>' : '';
            const priceClass = isSold ? 'price sold' : 'price';
            const buyButton = isSold
                ? '<button class="buy-button sold-out" disabled>Sold</button>'
                : `<button class="buy-button" data-id="${sanitize(painting.id)}" onclick="addToCart('${sanitize(painting.id)}')">Buy Now</button>`;

            return `
                <div class="art-item" data-id="${sanitize(painting.id)}">
                    <div class="image-wrapper">
                        <a href="${sanitize(painting.image)}" data-title="${sanitize(painting.title)} - ${sanitize(painting.medium)}, ${sanitize(painting.dimensions)}">
                            <img src="${sanitize(painting.image)}" alt="${sanitize(painting.alt || painting.title)}" loading="lazy">
                        </a>
                        ${soldBadge}
                    </div>
                    <div class="item-details">
                        <h3>${sanitize(painting.title)}</h3>
                        <p class="medium">${sanitize(painting.medium)}, ${sanitize(painting.dimensions)}</p>
                        ${painting.description ? `<p class="description">${sanitize(painting.description)}</p>` : ''}
                        <div class="price-row">
                            <span class="${priceClass}">${formatPrice(painting.price)}</span>
                            ${buyButton}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Set up filter buttons for All / Available / Sold.
     */
    function setupFilters() {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                filterButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                const filter = this.dataset.filter;
                let filtered;
                switch (filter) {
                    case 'available':
                        filtered = allPaintings.filter(p => p.available);
                        break;
                    case 'sold':
                        filtered = allPaintings.filter(p => !p.available);
                        break;
                    default:
                        filtered = allPaintings;
                }
                renderGallery(filtered);
            });
        });
    }

    /**
     * Sanitize string for safe HTML output.
     */
    function sanitize(str) {
        if (str === undefined || str === null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    /* ----------------------------------------------------------
       SHOPIFY BUY SDK INTEGRATION
       ----------------------------------------------------------
       Uses the Shopify JS Buy SDK (lightweight client) to create
       a checkout and redirect. The site's own "Buy Now" button
       is used for all paintings — no Shopify visual components.
       ---------------------------------------------------------- */

    /**
     * Initialize the Shopify JS Buy SDK client.
     */
    function initShopify() {
        const scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';

        if (window.ShopifyBuy) {
            shopifyClient = window.ShopifyBuy.buildClient({
                domain: SHOPIFY_CONFIG.domain,
                storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken
            });
            return;
        }

        const script = document.createElement('script');
        script.async = true;
        script.src = scriptURL;
        script.onload = function () {
            shopifyClient = window.ShopifyBuy.buildClient({
                domain: SHOPIFY_CONFIG.domain,
                storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken
            });
        };
        document.head.appendChild(script);
    }

    /**
     * "Buy Now" click handler.
     * If the painting has a Shopify product ID and the SDK is loaded,
     * fetch the product, create a checkout, and redirect.
     * Otherwise fall back to email inquiry.
     */
    window.addToCart = function (paintingId) {
        const painting = allPaintings.find(p => p.id === paintingId);
        if (!painting) return;

        // Shopify checkout path
        if (SHOPIFY_CONFIG.enabled && shopifyClient && painting.shopifyProductId) {
            const btn = document.querySelector(`.buy-button[data-id="${paintingId}"]`);
            if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }

            shopifyClient.product.fetch('gid://shopify/Product/' + painting.shopifyProductId)
                .then(function (product) {
                    const variantId = product.variants[0].id;
                    return shopifyClient.checkout.create().then(function (checkout) {
                        return shopifyClient.checkout.addLineItems(checkout.id, [{
                            variantId: variantId,
                            quantity: 1
                        }]);
                    });
                })
                .then(function (checkout) {
                    window.location.href = checkout.webUrl;
                })
                .catch(function (err) {
                    console.error('Shopify checkout error:', err);
                    if (btn) { btn.textContent = 'Buy Now'; btn.disabled = false; }
                    // Fall back to email
                    openEmailInquiry(painting);
                });
            return;
        }

        // Fallback: direct contact via email
        openEmailInquiry(painting);
    };

    /**
     * Open a pre-filled email to the artist.
     */
    function openEmailInquiry(painting) {
        const subject = encodeURIComponent(`Inquiry about "${painting.title}"`);
        const body = encodeURIComponent(
            `Hello Inesa,\n\nI am interested in purchasing "${painting.title}" (${painting.medium}, ${painting.dimensions}) listed at ${formatPrice(painting.price)}.\n\nPlease let me know how to proceed.\n\nThank you!`
        );
        window.location.href = `mailto:contact@inesacole.art?subject=${subject}&body=${body}`;
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
