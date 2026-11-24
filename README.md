# Salon Queue Management System

**Live demo:** Deployment pending.

## Project status

This repository contains the initial app setup. All six documented screens are navigable, and the frontend, Express backend, SQLite connection, and Socket.IO foundation are in place. Queue and service functionality will be implemented in later tasks.

## Requirements

- Node.js 26.13.1 and npm
- Tailwind CSS v4 through the Vite plugin

Node.js 26 provides the built-in node:sqlite module, so no native SQLite dependency installation is required. Tailwind uses the v4 Vite integration and CSS import; this project does not use v3 PostCSS directives or configuration.

## Install dependencies

In PowerShell from the repository root, use separate terminals.

Frontend terminal:

    cd frontend
    Copy-Item .env.example .env
    npm install

Backend terminal:

    cd backend
    Copy-Item .env.example .env
    npm install

The real .env files are ignored by Git and contain local configuration only.

## Run the frontend

From the frontend directory:

    npm run dev

Open the URL printed by Vite, normally http://localhost:5173. The development proxy forwards /api and Socket.IO traffic to VITE_API_URL in frontend/.env.

## Run the backend

From the backend directory in a separate terminal:

    npm run dev

The backend listens at http://localhost:3001 by default. Its SQLite database path is configured in backend/.env; the parent folder is created automatically.

## Verify

- Open http://localhost:5173 and use the navigation for /, /join, /queue/demo, /staff, /display, and /admin.
- Open http://localhost:3001/api/health or run Invoke-RestMethod http://localhost:3001/api/health in PowerShell. Expected response: status is ok.
- The frontend API helper calls /api/health through the Vite proxy.

Socket.IO is initialized for future realtime updates. Queue events and queue database tables are not implemented in this setup task.

## Documentation

- docs/01-brief.md
- docs/02-screens.md
- docs/03-flows-rules.md
- AGENTS.md