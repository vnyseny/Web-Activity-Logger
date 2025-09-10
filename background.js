// Background script for EnquiryID Logger

// Track injected tabs to prevent duplicate injection
const injectedTabs = new Set();

// Listen for tab updates and inject content script on monitored sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    checkAndInjectContentScript(tabId, tab.url);
  }
});

// Listen for tab activation and inject content script if needed
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (tab.url && tab.url.startsWith('http')) {
      checkAndInjectContentScript(activeInfo.tabId, tab.url);
    }
  });
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Check if tab URL matches monitored sites and inject content script
async function checkAndInjectContentScript(tabId, url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Skip if already injected
    if (injectedTabs.has(tabId)) {
      return;
    }
    
    const data = await chrome.storage.local.get(['monitoredSites']);
    const monitoredSites = data.monitoredSites || [];
    
    // Send message to content script to check if it should be active on this site
    const isMonitoredSite = monitoredSites.length > 0 && monitoredSites.some(site => hostname.includes(site));

    if (isMonitoredSite) {
      // Content script is already injected via manifest, just notify it to start working
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'activate', monitoredSites });
      } catch (err) {
        // Content script might not be ready yet, this is normal
      }
    } else {
      // Tell content script to deactivate if it's not on a monitored site
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'deactivate' });
      } catch (err) {
        // Content script might not be ready yet, this is normal
      }
    }
  } catch (e) {
    console.error('Error checking URL:', e);
  }
}

// Listen for messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle ping from popup
  if (message.action === 'ping') {
    sendResponse({ pong: true, timestamp: new Date().toISOString() });
    return;
  }

  // Handle activation status request from content script
  if (message.action === 'getActivationStatus' && message.hostname) {
    chrome.storage.local.get(['monitoredSites'], (data) => {
      const monitoredSites = data.monitoredSites || [];
      const shouldActivate = monitoredSites.some(site => message.hostname.includes(site));
      sendResponse({ shouldActivate });
    });
    return;
  }
  if (message.type === 'LOG_PARAMETER' && message.paramName && message.paramValue && message.url) {
    const paramName = message.paramName;
    const paramValue = message.paramValue;
    const url = message.url;


    // Validate parameter value
    if (typeof paramValue !== 'string' || paramValue.trim().length === 0) {
      console.error(`Invalid ${paramName} value received:`, paramValue);
      return;
    }

    // Get current time in local timezone
    const now = new Date();
    const timestamp = now.toISOString();

    // Extract enquiryId from URL if this is an enquiryId parameter
    let enquiryId = null;
    try {
      const urlObj = new URL(url);
      const enquiryIdParam = urlObj.searchParams.get('enquiryid');
      if (enquiryIdParam) {
        // Try to decode Base64
        try {
          enquiryId = atob(enquiryIdParam);
        } catch {
          enquiryId = enquiryIdParam; // Use raw value if decoding fails
        }
      }
    } catch (e) {
      console.error('Error extracting enquiryId from URL:', e);
    }

    if (!enquiryId) {
      console.log('No enquiryId found in URL, cannot save parameter');
      return;
    }

    // Save to storage with enquiryId-based structure
    chrome.storage.local.get(['enquiryData'], store => {
      try {
        let enquiryData = store.enquiryData || {};

        // Initialize enquiryId object if it doesn't exist
        if (!enquiryData[enquiryId]) {
          enquiryData[enquiryId] = {
            enquiryId,
            url,
            firstSeen: timestamp,
            lastUpdated: timestamp,
            parameters: {}
          };
        }

        // Update the parameter (only if new value is not empty)
        if (paramValue && paramValue.trim()) {
          enquiryData[enquiryId].parameters[paramName] = {
            value: paramValue.trim(),
            lastUpdated: timestamp,
            source: 'URL'
          };
          enquiryData[enquiryId].lastUpdated = timestamp;
          enquiryData[enquiryId].url = url; // Update URL in case it changed
        }

        chrome.storage.local.set({ enquiryData }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to save enquiry data:', chrome.runtime.lastError);
          } else {

            // Check if notifications are enabled and show notification
          }
        });
      } catch (error) {
        console.error('Error saving enquiry data:', error);
      }
    });
  } else if (message.type === 'LOG_DOM_PARAMETER' && message.paramName !== undefined && message.url) {
    const paramName = message.paramName;
    const paramValues = message.paramValues || [''];
    const selector = message.selector;
    const url = message.url;
    const elementsFound = message.elementsFound || 1;
    const forced = message.forced || false;

    // Get current time in local timezone
    const now = new Date();
    const timestamp = now.toISOString();

    const nonEmptyValues = paramValues.filter(v => v.length > 0);

    // Extract enquiryId from URL for DOM parameters
    let enquiryId = null;
    try {
      const urlObj = new URL(url);
      const enquiryIdParam = urlObj.searchParams.get('enquiryid');
      if (enquiryIdParam) {
        // Try to decode Base64
        try {
          enquiryId = atob(enquiryIdParam);
        } catch {
          enquiryId = enquiryIdParam; // Use raw value if decoding fails
        }
      }
    } catch (e) {
      console.error('Error extracting enquiryId from URL for DOM parameter:', e);
    }

    if (!enquiryId) {
      console.log('No enquiryId found in URL, cannot save DOM parameter');
      return;
    }

    // Save to storage with enquiryId-based structure
    chrome.storage.local.get(['enquiryData'], store => {
      try {
        let enquiryData = store.enquiryData || {};

        // Initialize enquiryId object if it doesn't exist
        if (!enquiryData[enquiryId]) {
          enquiryData[enquiryId] = {
            enquiryId,
            url,
            firstSeen: timestamp,
            lastUpdated: timestamp,
            parameters: {}
          };
        }

        // Update the DOM parameter (store as array, but only if new values are not empty)
        if (nonEmptyValues.length > 0) {
          enquiryData[enquiryId].parameters[paramName] = {
            value: paramValues,
            selector: selector,
            elementsFound: elementsFound,
            lastUpdated: timestamp,
            source: 'DOM',
            forced: forced
          };
          enquiryData[enquiryId].lastUpdated = timestamp;
          enquiryData[enquiryId].url = url; // Update URL in case it changed
        }

        chrome.storage.local.set({ enquiryData }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to save DOM enquiry data:', chrome.runtime.lastError);
          } else {

            // Only show notification for non-empty values
            if (nonEmptyValues.length > 0) {
            }
          }
        });
      } catch (error) {
        console.error('Error saving DOM enquiry data:', error);
      }
    });
  }
});

// Show notification for new parameter detection