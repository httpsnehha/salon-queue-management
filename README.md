# Salon Queue Management System

A responsive salon queue application built with React, Vite, TypeScript, Tailwind CSS v4, Express, Node.js built-in SQLite, and Socket.IO.

## Requirements

- Node.js 26.13.1 (uses the built-in `node:sqlite` module)
- npm

## First-time setup (PowerShell)

From the project root, open two terminals.

Frontend terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
```

Backend terminal:

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Set a private staff code and a random session secret in `backend/.env`. For example, generate a secret with PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Copy the generated value into `STAFF_SESSION_SECRET`; set `STAFF_ACCESS_CODE` to a value you choose. Do not commit the real `.env` files. The SQLite database is created under `backend/data` by default.

## Run the application

In the frontend terminal:

```powershell
npm run dev
```

In the backend terminal:

```powershell
npm run dev
```

Vite serves the frontend at http://localhost:5173 and proxies API and Socket.IO traffic to the backend at http://localhost:3001. Backend CORS uses `FRONTEND_ORIGIN`. `QUEUE_TIME_ZONE` defaults to `Asia/Kolkata` and can be changed in `backend/.env`.

## Routes

- Customer Home and Services: `/`
- Join Queue: `/join`
- Customer Queue Status: `/queue/:id`
- Reception Queue Dashboard: `/staff`
- Live Queue Display: `/display`
- Owner Settings: `/admin`
- Barber View: `/barber`

Management pages use the backend-configured staff access-code session. Queue registrations use daily sequential tokens. SQLite startup performs safe additive/workflow migrations while retaining historical customer and service snapshots.

## Verify and test

Health check (backend running):

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Run automated backend tests:

```powershell
cd backend
npm test
npm run build
```

Build the frontend in a separate terminal:

```powershell
cd frontend
npm run build
```

Manual checks: create an on-duty barber in Owner Settings, join online and as a staff walk-in, call the next eligible customer, start and finish the service from Barber View or Reception, verify customer status and Live Display update, try cancellation and the 10-minute no-show rule, and toggle online joining closed to check the customer explanation and continued walk-in registration.

Automated build and test results are reported for the exact current revision; browser and physical TV checks are only reported when performed.
