# 🔐 Passcode Authentication Model

This document outlines the authentication system built to protect access to the **TCG Card Pricing Application**.

---

## 🔒 Security Architecture Overview

Since GitHub Pages serves static client-side JavaScript, traditional server-side session cookies are not applicable without a remote backend server.

To provide access control:
1. **Passcode Protection Screen**: When users visit the web app, an **Access Gate Screen** blocks the application dashboard until a valid passcode is entered.
2. **SHA-256 Hashed Passcode Storage**: To prevent plain-text passcodes from being easily read in client source code, the application stores a **SHA-256 hash** of the allowed passcode in `frontend/src/config/auth.js`.
3. **Session State**: Upon entering the correct passcode, the browser stores an encrypted session token in `sessionStorage`. Closing the tab or browser resets the session.

---

## 🛠️ How to Change the Passcode

To set a custom passcode for your cousin:

1. Generate a SHA-256 hash of your desired passcode (e.g. using terminal):
   ```bash
   echo -n "YourSecretPasscode" | shasum -a 256
   ```

2. Update `frontend/src/config/auth.js`:
   ```javascript
   export const AUTH_CONFIG = {
     // SHA-256 hash of your passcode
     PASSCODE_HASH: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     DEFAULT_PASSCODE_TEXT: "card-trading-2026", // Reference hint for private repo
   };
   ```

---

## 🛡️ Security Considerations

- **Client-Side Gatekeeping**: Protects your cousin's workspace from unauthorized visitors, search engine indexing bots, and random web users.
- **Private Repository**: Keeping your repository private on GitHub ensures that your source code and configurations remain confidential while still deploying the compiled web app to GitHub Pages.
