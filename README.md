# Rephrase It

**Select text anywhere, right-click, pick a tone. Done.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/rephrase-it/cfpjlmhgebbmimbdkljdmoohcpnfoojk)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://chromewebstore.google.com/detail/rephrase-it/cfpjlmhgebbmimbdkljdmoohcpnfoojk)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-green)](manifest.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Rewrite any selected text in ten tones using Google Gemini — without leaving the page you're on. Works in text inputs, content-editable fields, and plain page text.

**[Install from the Chrome Web Store →](https://chromewebstore.google.com/detail/rephrase-it/cfpjlmhgebbmimbdkljdmoohcpnfoojk)**

---

## Tones

| | | |
|---|---|---|
| **Formal** — official documents | **Professional** — workplace polish | **Casual** — conversational |
| **Friendly** — warm and approachable | **Confident** — assertive | **Persuasive** — compelling |
| **Concise** — shorter and direct | **Elaborate** — more detail | **Simple** — plain language |
| **Sarcastic** — witty | | |

Plus custom prompts, and a history of recent edits.

## How it works

1. Select text on any page
2. Right-click → **Rephrase It** → pick a tone
3. **Copy** the result, or **Replace** to substitute it in place

## Setup

You bring your own Gemini key, so there's no subscription and no middleman.

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click the extension icon, paste it, save

Google's free tier is generous — 15 requests/minute, 1,500/day, 1M tokens/month.

---

## Privacy

- **No backend.** There is no server of mine between you and Google.
- Your API key is stored in `chrome.storage`, on your device.
- Selected text is sent to Gemini only when you explicitly pick a tone. Nothing is sent in the background.
- No analytics, no tracking, no account.

**Permissions are deliberately narrow.** The extension declares `contextMenus`, `activeTab`, `storage`, and `scripting` — and no `host_permissions` at all. An earlier build requested broad host access; it was removed, because `activeTab` grants access only to the tab you're actively using, only when you invoke the extension.

See the [privacy policy](PRIVACY_POLICY.md).

---

## Troubleshooting

**"Please set your Google Gemini API key"** — Click the extension icon and save a valid key.

**Key rejected** — Verify it starts with `AIza`, that the Gemini API is enabled in Google AI Studio, and try regenerating it.

**Replace doesn't work on some sites** — Replacement works in inputs and content-editable areas. Some sites block programmatic text modification; use Copy instead.

## Development

```bash
git clone https://github.com/vamshimorlawar/rephrase-extension
```

Chrome → `chrome://extensions/` → **Developer mode** → **Load unpacked** → select the repo folder.

```
manifest.json      Extension config (MV3)
background.js      Service worker - context menu, Gemini calls
content.js/css     In-page result panel and text replacement
popup.html/js/css  API key setup and history
```

## License

MIT — see [LICENSE](LICENSE).
