/* ============================================================
   Inesa Cole ART - Admin Panel (Vercel Proxy Version)
   GitHub is the source of truth. localStorage is only an offline cache.
   ============================================================ */

(function () {
    'use strict';

    // Vercel proxy keeps the GitHub token server-side and secret
    const PROXY_URL = 'https://inesa-cole-proxy.vercel.app';

    const STORAGE_KEY = 'inesacole_paintings';
    const AUTH_KEY = 'inesacole_admin_auth';
    const ADMIN_PASSWORD = 'inesaart2025';

    let paintings = [];
    let paintingsSha = null;          // SHA of data/paintings.json on GitHub
    let editingId = null;
    const recentlyUploadedImages = new Map(); // path -> data URL, for immediate preview before Pages rebuilds

    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const passwordInput = document.getElementById('password-input');
    const paintingsGrid = document.getElementById('paintings-grid');
    const paintingCount = document.getElementById('painting-count');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const paintingForm = document.getElementById('painting-form');
    const imageInput = document.getElementById('image-input');
    const imagePreview = document.getElementById('image-preview');
    const imageUrlInput = document.getElementById('image-url');
    const uploadArea = document.getElementById('upload-area');
    const uploadText = document.getElementById('upload-text');

    /* ----------------------------------------------------------
       GITHUB VIA VERCEL PROXY
       The token lives only in Vercel env vars — never in this file.
       ---------------------------------------------------------- */
    async function githubApiRequest(method, path, body = null) {
        const response = await fetch(`${PROXY_URL}/api/github-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ password: ADMIN_PASSWORD, method, path, body })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`GitHub Error: ${response.status} - ${errData.message || errData.error || 'Unknown error'}`);
        }
        return response.json();
    }

    function b64DecodeUnicode(str) {
        return decodeURIComponent(
            atob(str.replace(/\n/g, ''))
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
    }

    function b64EncodeUnicode(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    function getFileBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function getFileDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function init() {
        setupEventListeners();
        if (sessionStorage.getItem(AUTH_KEY) === 'true') {
            showDashboard();
        } else {
            showLogin();
        }
    }

    function setupEventListeners() {
        loginForm.addEventListener('submit', handleLogin);
        paintingForm.addEventListener('submit', handleSavePainting);
        imageInput.addEventListener('change', handleImageSelect);
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });
    }

    function handleLogin(e) {
        e.preventDefault();
        const password = passwordInput.value.trim();

        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem(AUTH_KEY, 'true');
            showDashboard();
            loginError.style.display = 'none';
        } else {
            loginError.style.display = 'block';
            loginError.textContent = 'Wrong password. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    function showLogin() {
        loginScreen.style.display = 'block';
        dashboard.style.display = 'none';
    }

    function showDashboard() {
        loginScreen.style.display = 'none';
        dashboard.style.display = 'block';
        // Always refresh from GitHub when the dashboard appears.
        loadPaintingsFromGitHub();
    }

    function logout() {
        sessionStorage.removeItem(AUTH_KEY);
        showLogin();
        passwordInput.value = '';
    }

    /* ----------------------------------------------------------
       LOAD: GitHub is the source of truth.
       localStorage is only used if GitHub is unreachable.
       ---------------------------------------------------------- */
    async function loadPaintingsFromGitHub() {
        if (paintingCount) paintingCount.textContent = 'Loading from GitHub…';
        if (paintingsGrid) {
            paintingsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #888;">Syncing with GitHub…</div>';
        }
        try {
            const fileInfo = await githubApiRequest('GET', 'data/paintings.json');
            paintingsSha = fileInfo.sha;
            const decoded = b64DecodeUnicode(fileInfo.content);
            paintings = JSON.parse(decoded);
            saveLocalCache();
            renderPaintings();
        } catch (err) {
            console.error('GitHub fetch failed:', err);
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                paintings = JSON.parse(stored);
                renderPaintings();
                showToast(`Offline mode — cannot reach GitHub. Showing cached data. (${err.message})`, 'error');
            } else {
                paintings = [];
                renderPaintings();
                showToast(`Could not load from GitHub: ${err.message}`, 'error');
            }
        }
    }

    function saveLocalCache() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(paintings));
        } catch (err) {
            // localStorage might be full (base64 images used to blow it up); ignore
            console.warn('localStorage cache write failed:', err);
        }
    }

    /* ----------------------------------------------------------
       PUSH: write current paintings[] to GitHub.
       Always re-fetches SHA first to avoid conflicts.
       ---------------------------------------------------------- */
    async function pushPaintingsToGitHub(commitMessage) {
        let currentSha = paintingsSha;
        try {
            const fileInfo = await githubApiRequest('GET', 'data/paintings.json');
            currentSha = fileInfo.sha;
        } catch (err) {
            // File may not exist yet — that's fine, we'll create it
            currentSha = null;
        }

        // Strip any transient fields before persisting
        const cleanPaintings = paintings.map(p => {
            const out = { ...p };
            delete out.imageData;
            return out;
        });

        const jsonContent = b64EncodeUnicode(JSON.stringify(cleanPaintings, null, 2));
        const putBody = {
            message: commitMessage,
            content: jsonContent
        };
        if (currentSha) putBody.sha = currentSha;

        const result = await githubApiRequest('PUT', 'data/paintings.json', putBody);
        if (result && result.content && result.content.sha) {
            paintingsSha = result.content.sha;
        }
        saveLocalCache();
    }

    function renderPaintings() {
        if (!paintingsGrid) return;
        const count = paintings.length;
        const available = paintings.filter(p => p.available).length;
        const sold = count - available;
        paintingCount.textContent = `${count} painting${count !== 1 ? 's' : ''} total, ${available} available, ${sold} sold`;

        if (paintings.length === 0) {
            paintingsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #888;">
                    <p style="font-size: 1.1rem; margin-bottom: 1rem;">No paintings yet</p>
                </div>
            `;
            return;
        }

        paintingsGrid.innerHTML = paintings.map(painting => {
            const statusClass = painting.available ? 'available' : 'sold';
            const statusText = painting.available ? 'Available' : 'Sold';
            const imageUrl = painting.image || '';
            // Use in-memory data URL for freshly uploaded images so they display
            // before GitHub Pages has rebuilt. Fall back to path.
            const displayUrl = recentlyUploadedImages.get(imageUrl) || imageUrl;
            const imgTag = displayUrl
                ? `<img src="${sanitize(displayUrl)}" alt="${sanitize(painting.title)}" onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='flex');"><div style="display:none;height:200px;background:#eee;align-items:center;justify-content:center;color:#aaa;">Image building on GitHub Pages…</div>`
                : '<div style="height:200px;background:#eee;display:flex;align-items:center;justify-content:center;color:#aaa;">No Image</div>';

            return `
                <div class="admin-painting-card">
                    ${imgTag}
                    <div class="admin-card-body">
                        <h3>${sanitize(painting.title)} <span class="status-badge ${statusClass}">${statusText}</span></h3>
                        <p class="meta">${sanitize(painting.medium)}, ${sanitize(painting.dimensions)}</p>
                        <div class="price-display">$${painting.price}</div>
                    </div>
                    <div class="admin-card-actions">
                        <button class="btn btn-secondary" onclick="adminApp.editPainting('${sanitize(painting.id)}')">Edit</button>
                        <button class="btn ${painting.available ? 'btn-success' : 'btn-secondary'}" onclick="adminApp.toggleAvailability('${sanitize(painting.id)}')">
                            ${painting.available ? 'Mark Sold' : 'Mark Available'}
                        </button>
                        <button class="btn btn-danger" onclick="adminApp.deletePainting('${sanitize(painting.id)}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function openModal(title) {
        modalTitle.textContent = title;
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        paintingForm.reset();
        imagePreview.style.display = 'none';
        uploadText.textContent = 'Click here or drag a photo';
        editingId = null;
    }

    function openAddForm() {
        editingId = null;
        paintingForm.reset();
        imagePreview.style.display = 'none';
        uploadText.textContent = 'Click here or drag a photo';
        document.getElementById('painting-available').checked = true;
        openModal('Add New Painting');
    }

    function editPainting(id) {
        const painting = paintings.find(p => p.id === id);
        if (!painting) return;

        editingId = id;
        document.getElementById('painting-title').value = painting.title || '';
        document.getElementById('painting-medium').value = painting.medium || '';
        document.getElementById('painting-dimensions').value = painting.dimensions || '';
        document.getElementById('painting-price').value = painting.price || '';
        document.getElementById('painting-year').value = painting.year || '';
        document.getElementById('painting-description').value = painting.description || '';
        document.getElementById('painting-available').checked = painting.available !== false;
        document.getElementById('painting-shopify-id').value = painting.shopifyProductId || '';
        imageUrlInput.value = painting.image || '';

        const imgSrc = recentlyUploadedImages.get(painting.image) || painting.image;
        if (imgSrc) {
            imagePreview.src = imgSrc;
            imagePreview.style.display = 'block';
            uploadText.textContent = 'Click to change photo';
        }
        openModal('Edit Painting');
    }

    async function handleSavePainting(e) {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading to GitHub…';
        submitBtn.disabled = true;

        // Snapshot for rollback if GitHub write fails
        const snapshot = JSON.parse(JSON.stringify(paintings));

        try {
            const title = document.getElementById('painting-title').value.trim();
            const medium = document.getElementById('painting-medium').value.trim();
            const dimensions = document.getElementById('painting-dimensions').value.trim();
            const price = parseFloat(document.getElementById('painting-price').value) || 0;
            const year = document.getElementById('painting-year').value.trim();
            const description = document.getElementById('painting-description').value.trim();
            const available = document.getElementById('painting-available').checked;
            const shopifyProductId = document.getElementById('painting-shopify-id').value.trim();

            let finalImageUrl = imageUrlInput.value.trim();
            let freshDataUrl = null;

            if (!title) {
                showToast('Please enter a painting title.', 'error');
                return;
            }

            // Upload image to GitHub if a new file was picked
            if (imageInput.files && imageInput.files[0]) {
                const file = imageInput.files[0];
                const dataURL = await getFileDataURL(file);
                const base64Content = dataURL.split(',')[1];
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const imagePath = `images/${Date.now()}-${safeName}`;

                submitBtn.textContent = 'Uploading image…';
                await githubApiRequest('PUT', imagePath, {
                    message: `Upload image: ${title}`,
                    content: base64Content
                });

                finalImageUrl = imagePath;
                freshDataUrl = dataURL;
                // Keep a data-URL fallback so the card renders immediately,
                // before GitHub Pages has rebuilt the site.
                recentlyUploadedImages.set(imagePath, dataURL);
            }

            if (editingId) {
                const index = paintings.findIndex(p => p.id === editingId);
                if (index !== -1) {
                    paintings[index] = {
                        ...paintings[index],
                        title, medium, dimensions, price, year, description, available, shopifyProductId,
                        image: finalImageUrl || paintings[index].image,
                        alt: title
                    };
                }
            } else {
                paintings.push({
                    id: 'painting-' + Date.now(),
                    title, medium, dimensions, price, year, description, available, shopifyProductId,
                    image: finalImageUrl,
                    alt: title,
                    featured: false
                });
            }

            // Push JSON to GitHub. If this throws, we roll back in catch.
            submitBtn.textContent = 'Updating database…';
            await pushPaintingsToGitHub(`Update gallery: ${title}`);

            renderPaintings();
            showToast('Saved to GitHub!', 'success');
            closeModal();

        } catch (error) {
            console.error(error);
            // Roll back in-memory state so the UI matches reality
            paintings = snapshot;
            renderPaintings();
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    }

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
            uploadText.textContent = file.name;
        };
        reader.readAsDataURL(file);
    }

    async function toggleAvailability(id) {
        const painting = paintings.find(p => p.id === id);
        if (!painting) return;

        const originalValue = painting.available;
        painting.available = !painting.available;
        renderPaintings();

        try {
            await pushPaintingsToGitHub(`Toggle availability: ${painting.title} → ${painting.available ? 'Available' : 'Sold'}`);
            showToast(`"${painting.title}" — ${painting.available ? 'Available' : 'Sold'} saved to GitHub.`, 'success');
        } catch (err) {
            // Roll back
            painting.available = originalValue;
            renderPaintings();
            showToast(`Failed to save to GitHub: ${err.message}`, 'error');
        }
    }

    async function deletePainting(id) {
        const painting = paintings.find(p => p.id === id);
        if (!painting) return;

        if (!confirm(`Are you sure you want to delete "${painting.title}"? This cannot be undone.`)) return;

        const snapshot = JSON.parse(JSON.stringify(paintings));
        paintings = paintings.filter(p => p.id !== id);
        renderPaintings();

        try {
            await pushPaintingsToGitHub(`Delete painting: ${painting.title}`);
            showToast(`"${painting.title}" deleted from GitHub.`, 'success');
        } catch (err) {
            // Roll back
            paintings = snapshot;
            renderPaintings();
            showToast(`Failed to delete from GitHub: ${err.message}`, 'error');
        }
    }

    function exportData() {
        const dataStr = JSON.stringify(paintings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paintings-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function (event) {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (!confirm(`Replace all paintings with imported data and push to GitHub?`)) return;
                    const snapshot = JSON.parse(JSON.stringify(paintings));
                    paintings = imported;
                    renderPaintings();
                    try {
                        await pushPaintingsToGitHub(`Import paintings from backup file`);
                        showToast('Imported and saved to GitHub.', 'success');
                    } catch (err) {
                        paintings = snapshot;
                        renderPaintings();
                        showToast(`Import failed to push to GitHub: ${err.message}`, 'error');
                    }
                } catch (err) {
                    showToast('Error reading file.', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async function refreshFromGitHub() {
        showToast('Refreshing from GitHub…', 'success');
        await loadPaintingsFromGitHub();
    }

    function clearLocalCache() {
        if (!confirm('Clear the local browser cache? (Does not affect GitHub — next load will re-sync.)')) return;
        localStorage.removeItem(STORAGE_KEY);
        recentlyUploadedImages.clear();
        showToast('Local cache cleared. Refreshing…', 'success');
        loadPaintingsFromGitHub();
    }

    function sanitize(str) {
        if (str === undefined || str === null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function showToast(message, type) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `toast ${type || ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    window.adminApp = {
        openAddForm, editPainting, toggleAvailability, deletePainting,
        exportData, importData, closeModal, logout,
        refreshFromGitHub, clearLocalCache
    };

    document.addEventListener('DOMContentLoaded', init);
})();
