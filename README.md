# Diary Assistant

A smart diary and log assistant built with React, Vite, and Gemini AI.

## 🚀 How to Build APK and EXE

To generate the actual `.apk` (Android) and `.exe` (Windows) files, you need to download the code to your own computer.

### 1. Prerequisites
- **Node.js** installed on your computer.
- **Android Studio** (for APK).
- **Windows** (for EXE).

### 2. Setup
1.  **Download/Clone** this repository to your computer.
2.  Open a terminal in the project folder and run:
    ```bash
    npm install
    ```

### 3. Build for Windows (.exe)
Run the following command:
```bash
npm run build
npm run electron:build
```
The `.exe` file will be generated in the `release/` folder.

### 4. Build for Android (.apk)
1.  Build the web app:
    ```bash
    npm run build
    ```
2.  Initialize Capacitor (only once):
    ```bash
    npm run cap:init
    npm run cap:add:android
    ```
3.  Sync the code:
    ```bash
    npm run cap:sync
    ```
4.  Open in Android Studio to build the APK:
    ```bash
    npm run cap:open:android
    ```

---

## 📱 Easy Alternative: Install as PWA (No Download Required)
You don't actually need an APK to use this as an app on your phone!
1.  Open the **App URL** in Chrome (Android) or Safari (iPhone).
2.  Tap the **"Install"** tab in the app (bottom right icon).
3.  Follow the instructions to **"Add to Home Screen"**.
4.  The app will now appear on your home screen and work exactly like a native app!
