
# MyAI

MyAI is an AI chat application built with React and packaged for Android using Capacitor. Its AI features are powered by a separately hosted backend on Cloudflare Workers.

## Features

- AI chat through the MyAI backend
- Account registration and sign-in
- Conversation history and backend-supported cloud conversations
- Light and dark appearance
- File attachments and extraction from supported document and code formats
- Android APK builds using GitHub Actions

Some features require an active backend and depend on its configuration and availability.

## Project Details

- **Application:** MyAI
- **Android package:** `com.myai.app`
- **Frontend:** React
- **Android framework:** Capacitor
- **Backend:** Cloudflare Workers
- **License:** Apache License 2.0

## Repositories

- **Frontend and Android:** https://github.com/AppMasterM/MyAI
- **Backend:** https://github.com/AppMasterM/myai-backend

## Run the Frontend Locally

Requirements: Node.js and npm.

```bash
git clone https://github.com/AppMasterM/MyAI.git
cd MyAI
npm ci
npm start
```

## Create a Production Build

```bash
npm ci
npm run build
```

The production web files are generated in the `build/` directory.

## Build the Android App

After installing the required Android SDK and configuring the project:

```bash
npm ci
npm run build
npx cap sync android
```

You can then build the Android project using Android Studio or the Gradle wrapper.

## Download a Signed APK

MyAI includes a GitHub Actions workflow at `.github/workflows/main.yml`.

1. Open the repository's **Actions** tab.
2. Select **MyAI Signed Android Release**.
3. Run the workflow or open a successful run.
4. Download the `MyAI-signed-release-apk` artifact.

To provide a permanent public download, attach the signed APK to a published GitHub Release.

The signing workflow uses repository secrets:
`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, and `KEY_PASSWORD`.

Never commit these secrets or the keystore to GitHub.

## Backend Configuration

The frontend connects to the deployed MyAI backend. Backend configuration, CORS settings, AI provider credentials, and other server secrets must be managed separately in the backend environment.

Never put private API keys, passwords, access tokens, or Cloudflare credentials in frontend source code.

## Security and Privacy

- Do not commit private environment files or signing keys.
- Protect account credentials and session tokens.
- Review backend data retention and privacy settings before distributing the application.
- Report security concerns privately to the project owner.

## License

This project is licensed under the Apache License, Version 2.0. See the `LICENSE` file for the full license terms.

Third-party dependencies and services may have their own licenses and terms.
