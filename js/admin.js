/* ============================================================
   Inesa Cole ART - Admin Panel
   ============================================================
   Simple, user-friendly painting management for the artist.

   Data is stored in localStorage under 'inesacole_paintings'.
   The artist can:
   - Add new paintings with photo, title, description, price
   - Edit existing paintings
   - Mark paintings as sold / available
   - Delete paintings
   - Export data as JSON backup
   - Import data from JSON backup
   ============================================================ */

(function () {
    'use strict';

    /* ----------------------------------------------------------
       CONFIGURATION
       ---------------------------------------------------------- */
    const STORAGE_KEY = 'inesacole_paintings';
    const AUTH_KEY = 'inesacole_admin_auth';
    // Simple password - change this to your own password
    const ADMIN_PASSWORD = 'inesaart2025';

    /* ----------------------------------------------------------
       STATE
       ---------------------------------------------------------- */
    let paintings = [];
    let editingId = null; // null = creating new, string = editing existing

    /* ----------------------------------------------------------
       DOM REFERENCES
       ---------------------------------------------------------- */
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
       INITIALIZATION
       ---------------------------------------------------------- */
    function init() {
        // Check if already logged in
        if (sessionStorage.getItem(AUTH_KEY) === 'true') {
            showDashboard();
        } else {
            showLogin();
        }

        // Load paintings data
        loadPaintings();

        // Event listeners
        setupEventListeners();
    }

    function setupEventListeners() {
        // Login form
        loginForm.addEventListener('submit', handleLogin);

        // Painting form submit
        paintingForm.addEventListener('submit', handleSavePainting);

        // Image file input change
        imageInput.addEventListener('change', handleImageSelect);

        // Modal close on overlay click
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) closeModal();
        });

        // Keyboard: Escape closes modal
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });
    }

    /* ----------------------------------------------------------
       AUTHENTICATION (simple client-side)
       ---------------------------------------------------------- */
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
        renderPaintings();
    }

    function logout() {
        sessionStorage.removeItem(AUTH_KEY);
        showLogin();
        passwordInput.value = '';
    }

    /* ----------------------------------------------------------
       DATA MANAGEMENT
       ---------------------------------------------------------- */
    function loadPaintings() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            paintings = JSON.parse(stored);
        } else {
            // First time: try to load from JSON file
            fetchInitialData();
        }
    }

    async function fetchInitialData() {
        try {
            const response = await fetch('data/paintings.json');
            if (response.ok) {
                paintings = await response.json();
                savePaintings();
                renderPaintings();
            }
        } catch (err) {
            console.log('No initial data file found, starting fresh.');
            paintings = [];
        }
    }

    function savePaintings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(paintings));
    }

    /* ----------------------------------------------------------
       RENDER PAINTINGS GRID
       ---------------------------------------------------------- */
    function renderPaintings() {
        if (!paintingsGrid) return;

        const count = paintings.length;
        const available = paintings.filter(p => p.available).length;
        const sold = count - available;
        paintingCount.textContent = `${count} painting${count !== 1 ? 's' : ''} total, ${available} available, ${sold} sold`;

        if (paintings.length === 0) {
            paintingsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #888;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">&#127912;</div>
                    <p style="font-size: 1.1rem; margin-bottom: 1rem;">No paintings yet</p>
                    <p>Click the <strong>"Add New Painting"</strong> button above to add your first painting.</p>
                </div>
            `;
            return;
        }

        paintingsGrid.innerHTML = paintings.map(painting => {
            const statusClass = painting.available ? 'available' : 'sold';
            const statusText = painting.available ? 'Available' : 'Sold';
            const imageUrl = painting.imageData || painting.image || '';
            const imgTag = imageUrl
                ? `<img src="${sanitize(imageUrl)}" alt="${sanitize(painting.title)}">`
                : '<div style="height:200px;background:#eee;display:flex;align-items:center;justify-content:center;color:#aaa;">No Image</div>';

            return `
                <div class="admin-painting-card">
                    ${imgTag}
                    <div class="admin-card-body">
                        <h3>
                            ${sanitize(painting.title)}
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </h3>
                        <p class="meta">${sanitize(painting.medium)}, ${sanitize(painting.dimensions)}</p>
                        <div class="price-display">${formatPrice(painting.price)}</div>
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

    /* ----------------------------------------------------------
       MODAL MANAGEMENT
       ---------------------------------------------------------- */
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

    /* ----------------------------------------------------------
       ADD / EDIT PAINTING
       ---------------------------------------------------------- */
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

        // Fill form fields
        document.getElementById('painting-title').value = painting.title || '';
        document.getElementById('painting-medium').value = painting.medium || '';
        document.getElementById('painting-dimensions').value = painting.dimensions || '';
        document.getElementById('painting-price').value = painting.price || '';
        document.getElementById('painting-year').value = painting.year || '';
        document.getElementById('painting-description').value = painting.description || '';
        document.getElementById('painting-available').checked = painting.available !== false;
        document.getElementById('painting-shopify-id').value = painting.shopifyProductId || '';
        imageUrlInput.value = painting.image || '';

        // Show image preview if available
        const imgSrc = painting.imageData || painting.image;
        if (imgSrc) {
            imagePreview.src = imgSrc;
            imagePreview.style.display = 'block';
            uploadText.textContent = 'Click to change photo';
        }

        openModal('Edit Painting');
    }

    function handleSavePainting(e) {
        e.preventDefault();

        const title = document.getElementById('painting-title').value.trim();
        const medium = document.getElementById('painting-medium').value.trim();
        const dimensions = document.getElementById('painting-dimensions').value.trim();
        const price = parseFloat(document.getElementById('painting-price').value) || 0;
        const year = document.getElementById('painting-year').value.trim();
        const description = document.getElementById('painting-description').value.trim();
        const available = document.getElementById('painting-available').checked;
        const shopifyProductId = document.getElementById('painting-shopify-id').value.trim();
        const imageUrl = imageUrlInput.value.trim();

        if (!title) {
            showToast('Please enter a painting title.', 'error');
            return;
        }

        // Get image data (either from file upload or URL)
        let imageData = null;
        if (imagePreview.style.display !== 'none' && imagePreview.src.startsWith('data:')) {
            imageData = imagePreview.src;
        }

        if (editingId) {
            // Update existing painting
            const index = paintings.findIndex(p => p.id === editingId);
            if (index !== -1) {
                paintings[index] = {
                    ...paintings[index],
                    title,
                    medium,
                    dimensions,
                    price,
                    year,
                    description,
                    available,
                    shopifyProductId,
                    image: imageUrl || paintings[index].image,
                    imageData: imageData || paintings[index].imageData,
                    alt: title
                };
                showToast('Painting updated successfully!', 'success');
            }
        } else {
            // Create new painting
            const newPainting = {
                id: generateId(),
                title,
                medium,
                dimensions,
                price,
                year,
                description,
                available,
                shopifyProductId,
                image: imageUrl,
                imageData: imageData,
                alt: title,
                featured: false
            };
            paintings.push(newPainting);
            showToast('New painting added!', 'success');
        }

        savePaintings();
        renderPaintings();
        closeModal();
    }

    /* ----------------------------------------------------------
       IMAGE HANDLING
       ---------------------------------------------------------- */
    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file (JPG, PNG, etc.)', 'error');
            return;
        }

        // Read file as data URL for preview and storage
        const reader = new FileReader();
        reader.onload = function (event) {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
            uploadText.textContent = file.name;
        };
        reader.readAsDataURL(file);
    }

    /* ----------------------------------------------------------
       PAINTING ACTIONS
       ---------------------------------------------------------- */
    function toggleAvailability(id) {
        const painting = paintings.find(p => p.id === id);
        if (painting) {
            painting.available = !painting.available;
            savePaintings();
            renderPaintings();
            const status = painting.available ? 'available' : 'sold';
            showToast(`"${painting.title}" marked as ${status}.`, 'success');
        }
    }

    function deletePainting(id) {
        const painting = paintings.find(p => p.id === id);
        if (!painting) return;

        if (confirm(`Are you sure you want to delete "${painting.title}"?\n\nThis action cannot be undone.`)) {
            paintings = paintings.filter(p => p.id !== id);
            savePaintings();
            renderPaintings();
            showToast(`"${painting.title}" has been deleted.`, 'success');
        }
    }

    /* ----------------------------------------------------------
       EXPORT / IMPORT
       ---------------------------------------------------------- */
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
        showToast('Backup file downloaded!', 'success');
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (!Array.isArray(imported)) {
                        throw new Error('Invalid format');
                    }
                    if (confirm(`This will replace all current paintings with ${imported.length} paintings from the backup.\n\nAre you sure?`)) {
                        paintings = imported;
                        savePaintings();
                        renderPaintings();
                        showToast(`Imported ${imported.length} paintings successfully!`, 'success');
                    }
                } catch (err) {
                    showToast('Could not read the backup file. Make sure it is a valid paintings JSON file.', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Reset to original data from the JSON file.
     */
    function resetToDefaults() {
        if (confirm('This will delete all your changes and reload the original paintings.\n\nAre you sure?')) {
            localStorage.removeItem(STORAGE_KEY);
            paintings = [];
            fetchInitialData().then(() => {
                showToast('Data has been reset to original paintings.', 'success');
            });
        }
    }

    /* ----------------------------------------------------------
       UTILITY
       ---------------------------------------------------------- */
    function sanitize(str) {
        if (str === undefined || str === null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function showToast(message, type) {
        // Remove existing toast
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

    /* ----------------------------------------------------------
       PUBLIC API (exposed for onclick handlers)
       ---------------------------------------------------------- */
    window.adminApp = {
        openAddForm,
        editPainting,
        toggleAvailability,
        deletePainting,
        exportData,
        importData,
        resetToDefaults,
        closeModal,
        logout
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', init);
})();
