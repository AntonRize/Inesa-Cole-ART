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
        allPaintings = await getPaintings();
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
                        <a href="${sanitize(painting.image)}" data-lightbox="art-gallery" data-title="${sanitize(painting.title)} - ${sanitize(painting.medium)}, ${sanitize(painting.dimensions)}">
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
                        ${painting.shopifyProductId ? `<div class="shopify-buy-frame" id="shopify-${sanitize(painting.id)}"></div>` : ''}
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
       SHOPIFY BUY BUTTON SDK INTEGRATION
       ----------------------------------------------------------
       Uses the Shopify Buy Button JS SDK (lightweight embed).
       When enabled, this replaces the basic "Buy Now" button
       with Shopify's hosted checkout flow.
       ---------------------------------------------------------- */

    /**
     * Initialize the Shopify Buy SDK.
     */
    function initShopify() {
        const scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';

        if (window.ShopifyBuy && window.ShopifyBuy.UI) {
            setupShopifyUI();
            return;
        }

        const script = document.createElement('script');
        script.async = true;
        script.src = scriptURL;
        script.onload = setupShopifyUI;
        document.head.appendChild(script);
    }

    /**
     * Set up Shopify UI components for each painting that has a product ID.
     */
    function setupShopifyUI() {
        const client = window.ShopifyBuy.buildClient({
            domain: SHOPIFY_CONFIG.domain,
            storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken
        });

        window.ShopifyBuy.UI.onReady(client).then(function (ui) {
            shopifyUI = ui;

            allPaintings.forEach(painting => {
                if (painting.shopifyProductId && painting.available) {
                    createShopifyButton(ui, painting);
                }
            });
        });
    }

    /**
     * Create a Shopify Buy Button for a specific painting.
     */
    function createShopifyButton(ui, painting) {
        const containerId = `shopify-${painting.id}`;
        const container = document.getElementById(containerId);
        if (!container) return;

        // Hide the default buy button for this painting
        const card = container.closest('.art-item');
        if (card) {
            const defaultBtn = card.querySelector('.buy-button');
            if (defaultBtn) defaultBtn.style.display = 'none';
        }

        ui.createComponent('product', {
            id: painting.shopifyProductId,
            node: container,
            moneyFormat: '%24%7B%7Bamount%7D%7D',
            options: {
                product: {
                    styles: {
                        product: { 'text-align': 'left' },
                        button: {
                            'background-color': '#8B6914',
                            'font-family': '"Lato", sans-serif',
                            'font-weight': 'bold',
                            'font-size': '14px',
                            'padding-top': '10px',
                            'padding-bottom': '10px',
                            ':hover': { 'background-color': '#A37E1A' },
                            ':focus': { 'background-color': '#A37E1A' }
                        },
                        price: { display: 'none' },
                        title: { display: 'none' }
                    },
                    contents: {
                        img: false,
                        title: false,
                        price: false,
                        button: true
                    },
                    text: { button: 'Purchase' }
                },
                cart: {
                    styles: {
                        button: {
                            'background-color': '#8B6914',
                            ':hover': { 'background-color': '#A37E1A' },
                            ':focus': { 'background-color': '#A37E1A' }
                        }
                    },
                    text: { total: 'Subtotal', button: 'Checkout' }
                }
            }
        });
    }

    /**
     * Fallback "Buy Now" handler when Shopify is not yet configured.
     * Shows a message directing to contact the artist.
     */
    window.addToCart = function (paintingId) {
        if (SHOPIFY_CONFIG.enabled && shopifyUI) {
            // Shopify handles it
            return;
        }
        // Fallback: direct contact
        const painting = allPaintings.find(p => p.id === paintingId);
        if (painting) {
            const subject = encodeURIComponent(`Inquiry about "${painting.title}"`);
            const body = encodeURIComponent(
                `Hello Inesa,\n\nI am interested in purchasing "${painting.title}" (${painting.medium}, ${painting.dimensions}) listed at ${formatPrice(painting.price)}.\n\nPlease let me know how to proceed.\n\nThank you!`
            );
            window.location.href = `mailto:contact@inesacole.art?subject=${subject}&body=${body}`;
        }
    };

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
