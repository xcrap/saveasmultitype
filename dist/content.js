/// <reference types="chrome"/>

let isProcessing = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({ status: "alive" });
        return;
    }

    if (request.action === "processImage" && !isProcessing) {
        isProcessing = true;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Unable to get 2D context');
                sendResponse({ error: 'Unable to get 2D context' });
                isProcessing = false;
                return;
            }
            ctx.drawImage(img, 0, 0);

            chrome.storage.sync.get(['jpgQuality', 'resize'], (items) => {
                const jpgQuality = items.jpgQuality ? items.jpgQuality / 100 : 0.9;
                const resizeOption = items.resize || 'none';

                if (resizeOption !== 'none') {
                    if (resizeOption === '50' || resizeOption === '75') {
                        const scale = Number.parseInt(resizeOption) / 100;
                        canvas.width = img.width * scale;
                        canvas.height = img.height * scale;
                    } else {
                        const maxSize = Number.parseInt(resizeOption);
                        const aspectRatio = img.width / img.height;
                        if (img.width > img.height) {
                            canvas.width = maxSize;
                            canvas.height = maxSize / aspectRatio;
                        } else {
                            canvas.height = maxSize;
                            canvas.width = maxSize * aspectRatio;
                        }
                    }
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }

                canvas.toBlob(blob => {
                    if (!blob) {
                        console.error('Failed to create blob');
                        sendResponse({ error: 'Failed to create blob' });
                        isProcessing = false;
                        return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        chrome.runtime.sendMessage({
                            action: "saveImage",
                            dataUrl: reader.result,
                            format: request.format
                        });
                        sendResponse({ success: true });
                        isProcessing = false;
                    };
                    reader.readAsDataURL(blob);
                }, `image/${request.format}`, request.format === 'jpeg' ? jpgQuality : undefined);
            });
        };
        img.onerror = () => {
            console.error('Failed to load image');
            sendResponse({ error: 'Failed to load image' });
            isProcessing = false;
        };
        img.src = request.dataUrl;
        return true; // Indicates that the response is sent asynchronously
    } if (isProcessing) {
        sendResponse({ error: 'Already processing an image' });
    }
});

console.log('Content script loaded');
