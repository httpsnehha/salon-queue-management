# Salon Queue Management System

A responsive salon queue application built with React, Vite, TypeScript, Tailwind CSS v4, Express, SQLite, and Socket.IO.

## Requirements

- Node.js 26.13.1 and npm

## Local setup

In PowerShell from the repository root, open two terminals. Copy the environment examples once if local .env files do not already exist:

    Copy-Item frontend/.env.example frontend/.env
    Copy-Item backend/.env.example backend/.env

Install dependencies:

    cd frontend
    npm install
    cd ..\backend
    npm install

For local development, leave VITE_API_URL empty. Vite proxies /api and Socket.IO traffic to http://localhost:3001. Configure STAFF_ACCESS_CODE and a random STAFF_SESSION_SECRET of at least 32 characters in backend/.env for staff authentication.

## Run locally

Frontend terminal:

    cd frontend
    npm run dev

Backend terminal:

    cd backend
    npm run dev

## Render backend and Vercel frontend

Set this environment variable in the Vercel frontend project:

- VITE_API_URL=https://salon-queue-management-2wt1.onrender.com

Set these in Render for the backend service:

- FRONTEND_ORIGIN: the exact origin of the deployed Vercel site (for example, https://your-project.vercel.app). Multiple exact origins may be comma-separated.
- STAFF_ACCESS_CODE: a private staff access code.
- STAFF_SESSION_SECRET: a random secret of at least 32 characters.
- Keep NODE_ENV=production so the staff session cookie uses Secure and SameSite=None for cross-origin requests.

After setting VITE_API_URL in Vercel, redeploy the frontend because Vite embeds environment variables at build time. Staff requests send credentials, and the backend allows credentialed CORS only from configured frontend origins. Do not put backend secrets in Vercel or frontend source code.

## Routes

- Customer Home and Services: /
- Join Queue: /join
- Customer Queue Status: /queue/:id
- Reception Queue Dashboard: /staff
- Live Queue Display: /display
- Owner Settings: /admin
- Barber View: /barber

## Verify and test

With the backend running, check its health:

    Invoke-RestMethod https://salon-queue-management-2wt1.onrender.com/api/health

Run the backend tests and builds:

    cd backend
    npm test
    npm run build
    cd ..\frontend
    npm run build

To verify the deployed frontend, open the Vercel URL, check customer services and queue status, then sign into Staff or Owner Settings and confirm the session persists across protected requests. Browser verification must be performed against the deployed origins after the Vercel and Render environment variables are configured.
