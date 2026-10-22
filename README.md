# MyAI

MyAI is an AI chat web application built with React, with a backend
powered by Cloudflare Workers.

## Project information

- **Project:** MyAI
- **Version:** 1.0.0
- **Frontend:** React
- **Backend:** Cloudflare Workers
- **Repository:** https://github.com/AppMasterM/MyAI
- **License:** Apache License 2.0

## Features

MyAI provides a web interface for interacting with its AI backend.
Available features depend on the current frontend implementation and
the configuration and availability of the backend.

## Requirements

- Node.js and npm
- A working MyAI backend for AI-powered functionality

## Run locally

Clone the repository:

```bash
git clone https://github.com/AppMasterM/MyAI.git
cd MyAI
```

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm start
```

## Create a production build

Run:

```bash
npm run build
```

The optimized production files are generated in the `build/` directory.

## Backend

The backend is maintained separately from this frontend repository.
For the current backend source, visit:

https://github.com/AppMasterM/myai-backend

Backend availability and configuration are required for server-powered
AI functionality. Never commit API keys, passwords, access tokens, or
private environment files to the repository.

## GitHub Actions

The workflow at `.github/workflows/main.yml` builds the frontend and
uploads the production build as a workflow artifact.

To run it manually, open the repository's **Actions** tab, select
**MyAI Build**, and choose **Run workflow**.

## License

This project is licensed under the Apache License, Version 2.0.
See the `LICENSE` file for the complete license text.
