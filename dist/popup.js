// @ts-check
/// <reference types="chrome"/>

document.addEventListener('DOMContentLoaded', () => {
    /** @type {HTMLInputElement} */
    const filenameInput = /** @type {HTMLInputElement} */ (document.getElementById('filename'));
    /** @type {HTMLInputElement} */
    const jpgQualityInput = /** @type {HTMLInputElement} */ (document.getElementById('jpgQuality'));
    /** @type {HTMLSelectElement} */
    const resizeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('resize'));

    if (!filenameInput || !jpgQualityInput || !resizeSelect) {
        console.error('One or more required elements not found');
        return;
    }

    // Load saved options
    chrome.storage.sync.get(['filename', 'jpgQuality', 'resize'], (items) => {
        filenameInput.value = items.filename || 'image-{date}';
        jpgQualityInput.value = items.jpgQuality?.toString() || '90';
        resizeSelect.value = items.resize || 'none';
    });

    // Function to save options
    function saveOptions() {
        const filename = filenameInput.value;
        const jpgQuality = Number.parseInt(jpgQualityInput.value, 10);
        const resize = resizeSelect.value;

        chrome.storage.sync.set({ filename, jpgQuality, resize }, () => {
            console.log('Options saved');
        });
    }

    // Add event listeners for input changes
    filenameInput.addEventListener('input', saveOptions);
    jpgQualityInput.addEventListener('input', saveOptions);
    resizeSelect.addEventListener('change', saveOptions);
});
