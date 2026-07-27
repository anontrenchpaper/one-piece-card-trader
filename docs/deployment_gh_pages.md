# 🚀 GitHub Pages Deployment Guide

This guide provides step-by-step instructions for deploying the **TCG Card Pricing Automation App** to **GitHub Pages**.

---

## 📋 Prerequisites

1. A **GitHub Repository** (Public or Private on GitHub Pro/Team/Enterprise).
2. Node.js & npm installed locally.

---

## 🛠️ Step-by-Step Deployment Steps

### Option A: Deployment via `gh-pages` npm package (Recommended)

1. **Install `gh-pages` helper**:
   ```bash
   cd frontend
   npm install --save-dev gh-pages
   ```

2. **Configure `vite.config.js` Base Path**:
   Set the base path to your repository name:
   ```js
   // frontend/vite.config.js
   export default defineConfig({
     base: '/dash-card-trading/',
     plugins: [react()],
   })
   ```

3. **Add Deploy Scripts in `frontend/package.json`**:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```

4. **Deploy**:
   ```bash
   cd frontend
   npm run deploy
   ```

5. **Enable GitHub Pages in Repository Settings**:
   - Go to your GitHub repository -> **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
   - Select branch **`gh-pages`** / `root` and click **Save**.

Your app will be live at `https://<your-github-username>.github.io/dash-card-trading/`!

---

### Option B: Automated Deployment via GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install & Build Frontend
        run: |
          cd frontend
          npm install
          npm run build

      - name: Upload GitHub Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'frontend/dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
