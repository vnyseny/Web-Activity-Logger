// Content script for Web Activity Logger - Only runs on monitored sites

// Track if script is already initialized to prevent duplicate setup
let isInitialized = false;
let isActive = false;

// Store DOM selectors and their last known values
let domSelectors = [];
let lastDomValues = new Map();

// Load DOM parameters from unified storage
function loadDomSelectors(callback) {
  chrome.storage.local.get(['monitoredParams'], data => {
    const monitoredParams = data.monitoredParams || [];
    // Filter for DOM parameters (not URL parameters)
    domSelectors = monitoredParams.filter(param => !param.isUrlParam);

    // Call callback if provided
    if (callback && typeof callback === 'function') {
      callback();
    }
  });
}

// Clear DOM values cache on page refresh
function clearDomCache() {
  lastDomValues.clear();
}

// Monitor DOM elements for text content changes
function monitorDomElements() {
  if (domSelectors.length === 0 || !isActive) {
    return;
  }

  domSelectors.forEach(selectorConfig => {
    try {
      const elements = document.querySelectorAll(selectorConfig.selector);

      if (elements.length === 0) {

        // Even if no elements found, capture empty array to show in grid
        const paramValues = [''];
        const valuesKey = paramValues.join('|');
        const key = `${selectorConfig.paramName}:${valuesKey}`;

        if (!lastDomValues.has(key)) {
          lastDomValues.set(key, valuesKey);


          // Send to background script for logging
          window.postMessage({
            type: 'LOG_DOM_PARAMETER',
            paramName: selectorConfig.paramName,
            paramValues: paramValues,
            selector: selectorConfig.selector,
            url: window.location.href,
            elementsFound: 0,
            elementDetails: []
          }, '*');
        } else {
        }

        return;
      }

      // Collect all values from matching elements
      const allValues = [];
      const elementDetails = [];

      elements.forEach((element, index) => {
        const textContent = element.textContent.trim();

        allValues.push(textContent || '');
        elementDetails.push({
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          index: index + 1
        });
      });

      // Create a unique key based on all values
      const valuesKey = allValues.join('|');
      const key = `${selectorConfig.paramName}:${valuesKey}`;

      // Check if this combination of values has changed or is new
      if (!lastDomValues.has(key)) {
        lastDomValues.set(key, valuesKey);

        const nonEmptyValues = allValues.filter(v => v.length > 0);

        // Send to background script for logging (always send, even if all empty)

        window.postMessage({
          type: 'LOG_DOM_PARAMETER',
          paramName: selectorConfig.paramName,
          paramValues: allValues, // Array of all values
          selector: selectorConfig.selector,
          url: window.location.href,
          elementsFound: elements.length,
          elementDetails: elementDetails
        }, '*');
      }
    } catch (error) {
      console.error('Error monitoring DOM selector:', error);
    }
  });
}

// Function to force capture all configured parameters (including empty ones)
function forceCaptureAllParameters() {
  if (domSelectors.length === 0) {
    return;
  }

  domSelectors.forEach(selectorConfig => {
    try {
      const elements = document.querySelectorAll(selectorConfig.selector);
      const allValues = [];

      elements.forEach((element, index) => {
        allValues.push(element.textContent.trim() || '');
      });

      // If no elements found, add empty value
      if (elements.length === 0) {
        allValues.push('');
      }

      const valuesKey = allValues.join('|');
      const key = `${selectorConfig.paramName}:${valuesKey}`;

      // Send to background script for logging
      window.postMessage({
        type: 'LOG_DOM_PARAMETER',
        paramName: selectorConfig.paramName,
        paramValues: allValues,
        selector: selectorConfig.selector,
        url: window.location.href,
        elementsFound: elements.length,
        forced: true,
        elementDetails: elements.length > 0 ? Array.from(elements).map((el, i) => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          index: i + 1
        })) : []
      }, '*');
    } catch (error) {
      console.error('Error force capturing DOM selector:', error);
    }
  });
}


// Monitor URL changes and check for monitored parameters
function checkUrlForParameters() {
  if (!isActive) {
    return;
  }

  try {
    const url = new URL(window.location.href);

    // Get monitored parameters from storage
    chrome.storage.local.get(['monitoredParams'], data => {
      const monitoredParams = data.monitoredParams || [];

      // Filter for URL parameters and extract their names
      const urlParameters = monitoredParams.filter(param => param.isUrlParam);

      // Check each URL parameter
      urlParameters.forEach(param => {
        const paramValue = url.searchParams.get(param.paramName);

        if (paramValue && paramValue.trim()) {
          try {
            // Decode Base64 parameter
            const decodedValue = atob(paramValue);

            // Validate decoded value
            if (decodedValue && decodedValue.trim()) {
              // Send to background script for logging (this script only runs on monitored sites)
              window.postMessage({
                type: 'LOG_PARAMETER',
                paramName: param.paramName,
                paramValue: decodedValue.trim(),
                url: window.location.href
              }, '*');
            }

          } catch (e) {
            // Try without Base64 decoding if it fails
            if (paramValue && paramValue.trim()) {
              window.postMessage({
                type: 'LOG_PARAMETER',
                paramName: param.paramName,
                paramValue: paramValue.trim(),
                url: window.location.href
              }, '*');
            }
          }
        }
      });
    });
  } catch (error) {
    console.error('Error checking URL for parameters:', error);
  }
}

// Initialize the content script
function initializeContentScript() {
  if (isInitialized) {
    return;
  }

  // Clear DOM cache for fresh start
  clearDomCache();

  // Load DOM selectors and start monitoring once loaded
  loadDomSelectors(() => {
    // Force immediate monitoring after a longer delay to catch slow-loading content
    setTimeout(() => monitorDomElements(), 3000);
    setTimeout(() => monitorDomElements(), 5000);
  });

  // Check URL parameters with a small delay to ensure activation status is set
  setTimeout(() => checkUrlForParameters(), 100);

  // Fallback: Check activation status periodically
  const checkActivationFallback = () => {
    if (!isActive) {
      // Try to get activation status from background script
      chrome.runtime.sendMessage({ action: 'getActivationStatus', hostname: window.location.hostname }, (response) => {
        if (response && response.shouldActivate) {
          isActive = true;
          checkUrlForParameters();
        }
      }).catch(() => {
        // Background script might not be ready, this is normal
      });
    }
  };

  // Check activation status every 2 seconds for the first 10 seconds
  let activationCheckCount = 0;
  const activationCheckInterval = setInterval(() => {
    activationCheckCount++;
    if (!isActive && activationCheckCount <= 5) {
      checkActivationFallback();
    } else {
      clearInterval(activationCheckInterval);
    }
  }, 2000);

  // Initial DOM monitoring with delays to ensure DOM is fully loaded
  setTimeout(() => monitorDomElements(), 500);
  setTimeout(() => monitorDomElements(), 1000);
  setTimeout(() => monitorDomElements(), 2000);

  // Monitor URL changes (for single-page applications)
  let currentUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      checkUrlForParameters();
    }
    // Also monitor DOM elements on page changes
    monitorDomElements();
  });

  observer.observe(document, { subtree: true, childList: true });

  // Also listen for popstate events (browser back/forward)
  window.addEventListener('popstate', () => {
    checkUrlForParameters();
    monitorDomElements();
  });

  // Listen for pushstate/replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    setTimeout(() => {
      checkUrlForParameters();
      monitorDomElements();
    }, 0);
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    setTimeout(() => {
      checkUrlForParameters();
      monitorDomElements();
    }, 0);
  };

  // More aggressive periodic DOM monitoring for dynamic content
  setInterval(monitorDomElements, 1000);

  // Handle page visibility change (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(() => monitorDomElements(), 200);
    }
  });

  // Additional monitoring for DOM content changes
  const contentObserver = new MutationObserver((mutations) => {
    let shouldMonitor = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldMonitor = true;
      } else if (mutation.type === 'characterData') {
        shouldMonitor = true;
      }
    });
    if (shouldMonitor) {
      // Debounce the monitoring to avoid too many calls
      setTimeout(() => monitorDomElements(), 100);
    }
  });

  contentObserver.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true
  });

  // Listen for messages from popup (force capture and status)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'forceCapture') {
      forceCaptureAllParameters();
      sendResponse({ success: true });
    } else if (message.action === 'status') {
      sendResponse({
        status: isActive ? 'active' : 'inactive',
        initialized: isInitialized,
        domSelectorsCount: domSelectors.length,
        lastActivity: new Date().toISOString()
      });
    } else if (message.action === 'activate') {
      isActive = true;
      // Immediately check URL parameters when activated
      setTimeout(() => checkUrlForParameters(), 50);
      sendResponse({ success: true });
    } else if (message.action === 'deactivate') {
      isActive = false;
      sendResponse({ success: true });
    }
  });

  // Forward messages to background
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'LOG_PARAMETER') {
      try {
        chrome.runtime.sendMessage({
          type: 'LOG_PARAMETER',
          paramName: event.data.paramName,
          paramValue: event.data.paramValue,
          url: event.data.url
        }).catch(error => {
          console.error('Failed to send message to background script:', error);
        });
      } catch (error) {
        console.error('Error sending message to background script:', error);
      }
    } else if (event.data && event.data.type === 'LOG_DOM_PARAMETER') {
      try {
        chrome.runtime.sendMessage({
          type: 'LOG_DOM_PARAMETER',
          paramName: event.data.paramName,
          paramValues: event.data.paramValues,
          selector: event.data.selector,
          url: event.data.url,
          elementsFound: event.data.elementsFound,
          elementDetails: event.data.elementDetails,
          forced: event.data.forced
        }).catch(error => {
          console.error('Failed to send DOM parameter message to background script:', error);
        });
      } catch (error) {
        console.error('Error sending DOM parameter message to background script:', error);
      }
    }
  });

  isInitialized = true;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
} 