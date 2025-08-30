# PreventWebCookie
📖 Project Description (English)

Cookie Guard – Chrome Extension

Overview:
Cookie Guard is a lightweight, open-source Chrome extension designed to protect your privacy by automatically rejecting non-essential cookies and dismissing cookie consent pop-ups. Unlike simple banner removers, Cookie Guard combines network-level blocking, cookie cleanup, and consent automation to ensure that only the cookies strictly necessary for website functionality are retained.

Key Features:
•	🚫 Auto-reject cookie banners – Detects common CMP (Consent Management Platform) dialogs and clicks “Reject all / Only necessary” automatically.
•	🍪 Cookie control – Monitors new cookies and removes those outside the allow-list.
•	🌐 Network filtering – Blocks known tracker domains using Chrome’s Declarative Net Request API.
•	📊 Local statistics – Counts and displays how many cookies were blocked and banners handled.
•	🔒 Privacy first – All processing happens locally; no user data is sent to external servers.
•	⚙️ Per-site control – Pause the extension or allow cookies for trusted sites.
•	💻 Cross-platform – Runs on Chrome desktop across Windows, macOS, Linux, and ChromeOS.

Technology Stack:
•	Manifest V3 (Chrome Extensions API)
•	JavaScript (background scripts, content scripts, popup UI)
•	HTML/CSS (UI components)
•	Chrome APIs: storage, cookies, declarativeNetRequest, contentSettings, privacy

Use Cases:
•	Privacy-minded users who want to avoid tracking.
•	Students and professionals in the EU needing GDPR-friendly browsing.
•	Developers exploring modern Chrome Extension practices.

Future Plans:
•	🔄 Multi-device sync (via chrome.storage.sync).
•	📈 Advanced analytics dashboard.
•	🌍 Firefox / Edge / Safari WebExtension support.

⸻