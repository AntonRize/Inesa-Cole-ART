/* ============================================================
   Inesa Cole ART - Shared Site JavaScript
   ============================================================ */

/**
 * Load paintings data from the JSON file.
 * Returns a promise that resolves to the array of paintings.
 */
async function loadPaintings() {
    try {
        const response = await fetch('data/paintings.json');
        if (!response.ok) throw new Error('Failed to load paintings data');
        return await response.json();
    } catch (error) {
        console.error('Error loading paintings:', error);
        // Fall back to localStorage if JSON fetch fails
        const stored = localStorage.getItem('inesacole_paintings');
        if (stored) {
            return JSON.parse(stored);
        }
        return [];
    }
}

/**
 * Get paintings from localStorage (admin-managed data takes priority).
 * If admin has saved data, use that. Otherwise fall back to JSON file.
 */
async function getPaintings() {
    const adminData = localStorage.getItem('inesacole_paintings');
    if (adminData) {
        return JSON.parse(adminData);
    }
    return await loadPaintings();
}

/**
 * Format price as currency string.
 */
function formatPrice(price) {
    return '$' + Number(price).toLocaleString('en-US');
}

/**
 * Generate a simple unique ID.
 */
function generateId() {
    return 'painting-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
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
