/* ============================================================
   Inesa Cole ART - Shared Site JavaScript
   ------------------------------------------------------------
   GitHub (data/paintings.json) is the single source of truth.
   No localStorage is read on public pages — that avoids the
   "different devices show different versions" desync.
   ============================================================ */

/**
 * Load paintings from data/paintings.json on GitHub Pages.
 * Cache-busts with a timestamp query string so browsers and
 * CDNs can't serve a stale version between devices.
 *
 * Returns an array (possibly empty). Never throws.
 */
async function loadPaintings() {
    const url = 'data/paintings.json?v=' + Date.now();
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('loadPaintings failed:', err);
        return [];
    }
}

/**
 * Format price as currency string.
 */
function formatPrice(price) {
    return '$' + Number(price).toLocaleString('en-US');
}

/**
 * Highlight the current page in navigation.
 */
function highlightCurrentNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });
}

// Run on every page
document.addEventListener('DOMContentLoaded', highlightCurrentNav);
