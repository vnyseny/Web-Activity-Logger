# 🌐 Domain URL Logger

A cross-browser extension for Chrome, Edge, and Firefox that logs URLs and timestamps for user-specified domains. Useful for productivity tracking, research logging, or auditing your web activity.

---

## Features
- **Domain Monitoring:** Add/remove domains to monitor (e.g., `wikipedia.org`).
- **URL & Timestamp Logging:** Automatically logs the full URL and timestamp when you visit a monitored domain.
- **Recent Logs:** View the last 20 logged entries in the popup.
- **Export Logs:** Download logs as JSON or CSV.
- **Clear Logs:** Remove all stored logs with one click.
- **Local Storage:** All data is stored locally in your browser.

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