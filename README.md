# 🌐 Web Activity Logger

A cross-browser extension for Chrome, Edge, and Firefox that logs web activity including URL parameters, DOM elements, and user interactions with timestamps. Useful for productivity tracking, research logging, data collection, or auditing your web activity.

---

## Features
- **Site Monitoring:** Add/remove websites to monitor for activity logging.
- **URL Parameter Tracking:** Automatically capture URL parameters and query strings.
- **DOM Element Monitoring:** Track changes in specific DOM elements using CSS selectors.
- **Interactive Data Grid:** View captured data in a sortable, filterable grid.
- **Advanced Filtering:** Filter by parameters, date ranges, and search terms.
- **Data Export:** Download data as JSON, CSV, or Excel formats.
- **Force Capture:** Manually trigger data capture for current page.
- **Local Storage:** All data is stored locally in your browser.
- **Real-time Updates:** Automatically captures data as you navigate monitored sites.

---

## Installation

1. **Clone or Download** this repository.
2. **Open your browser's Extensions page:**
   - Chrome/Edge: `chrome://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
3. **Enable Developer Mode.**
4. **Load Unpacked Extension:**
   - Select the `extenison` folder.
5. The extension icon should appear in your browser toolbar.

---

## Usage

1. Click the extension icon to open the popup.
2. **Add a domain** (e.g., `wikipedia.org`) and click "Add".
3. Visit any page on that domain. The extension will log the URL and timestamp.
4. **View logs** in the popup (last 20 entries shown).
5. **Export** logs as JSON or CSV, or **clear** logs as needed.

---

## Development Notes
- **Manifest V3** is used for Chrome/Edge. Should also work in Firefox (with minor adjustments if needed).
- **Background script** uses `chrome.storage.local` for data storage.
- **Popup UI** is built with HTML, CSS, and vanilla JS.
- **Icons** are placeholders; replace them with your own for production.

---

## Security & Privacy
- No data is sent externally. All logs are stored locally.
- Only URLs from user-enabled domains are tracked.

---

## License
MIT 