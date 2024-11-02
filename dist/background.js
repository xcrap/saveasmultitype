/// <reference types="chrome"/>

let isProcessing = false;
const contentScriptInjected = new Set();

function getFilename(format) {
    return new Promise((resolve) => {
        chrome.storage.sync.get('filename', (items) => {
            let filename = items.filename || 'image-{date}';
            filename = filename.replace('{date}', new Date().toISOString().split('T')[0]);
            resolve(`${filename}.${format}`);
        });
    });
}

function fetchImageAsBlob(url) {
    return fetch(url)
        .then(response => response.blob())
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }));
}

function saveImage(dataUrl, format) {
    if (isProcessing) return;
    isProcessing = true;

    getFilename(format).then(filename => {
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            isProcessing = false;
            if (chrome.runtime.lastError) {
                console.error("Download error:", chrome.runtime.lastError);
            } else if (downloadId === undefined) {
                console.log("Download cancelled by user");
            } else {
                console.log("Download started with ID:", downloadId);
            }
        });
    });
}

function injectContentScriptIfNeeded(tab) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: "ping" }, response => {
            if (chrome.runtime.lastError) {
                // Content script is not injected, so inject it
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        contentScriptInjected.add(tab.id);
                        resolve();
                    }
                });
            } else {
                // Content script is already injected
                resolve();
            }
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "saveAsJpg",
        title: "Save as JPG",
        contexts: ["image"]
    });

    chrome.contextMenus.create({
        id: "saveAsPng",
        title: "Save as PNG",
        contexts: ["image"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || typeof tab.id !== 'number') {
        console.error('Tab information is missing or invalid');
        return;
    }

    const format = info.menuItemId === "saveAsJpg" ? "jpeg" : "png";
    fetchImageAsBlob(info.srcUrl).then(dataUrl => {
        injectContentScriptIfNeeded(tab).then(() => {
            chrome.tabs.sendMessage(tab.id, { action: "processImage", dataUrl, format }, response => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    // If the content script is not responding, try reinjecting it
                    contentScriptInjected.delete(tab.id);
                    injectContentScriptIfNeeded(tab).then(() => {
                        // Try sending the message again
                        chrome.tabs.sendMessage(tab.id, { action: "processImage", dataUrl, format }, response => {
                            if (chrome.runtime.lastError) {
                                console.error('Error sending message after reinjection:', chrome.runtime.lastError);
                            } else if (response?.success) {
                                console.log("Image processed successfully after reinjection");
                            } else {
                                console.error("Image processing failed after reinjection:", response ? response.error : 'Unknown error');
                            }
                        });
                    }).catch(error => {
                        console.error('Error reinjecting content script:', error);
                    });
                } else if (response?.success) {
                    console.log("Image processed successfully");
                } else {
                    console.error("Image processing failed:", response ? response.error : 'Unknown error');
                }
            });
        }).catch(error => {
            console.error('Error injecting content script:', error);
        });
    }).catch(error => {
        console.error("Error fetching image:", error);
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveImage") {
        saveImage(request.dataUrl, request.format);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    contentScriptInjected.delete(tabId);
});
