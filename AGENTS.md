
# AGENTS.md — Salon Queue Management System

A responsive web application that allows salon customers to join a service queue, receive a token, and track their status while staff manage the queue.

## Read First

Before making changes, read all these documents:

- docs/01-brief.md — Project purpose, users, features, and boundaries.
- docs/02-screens.md — Screen layouts and interactions.
- docs/03-flows-rules.md — Queue flows, business rules, and test checklist.

Follow these documents as the source of truth.

## Technology Stack

- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS
- Backend: Node.js + Express
- Database: SQLite
- Realtime updates: Socket.IO
- Version control: Git and GitHub
- Deployment: Vercel for frontend and Render for backend

Do not replace this stack without explaining why and asking first.

## Working Rules

1. Build one screen or one feature at a time.
2. Do not build the entire application in one step.
3. Do not add features outside the project brief.
4. Use a modern blush pink, cream, and dark charcoal design.
5. Make the application mobile-first, then support desktop screens.
6. Use clear labels and large, accessible buttons.
7. Keep components reusable and code organized.
8. Validate user input.
9. Do not expose secrets or database credentials in frontend code.
10. Do not claim a feature works unless it has been tested.

## Testing and Reporting

After each task:

- Explain what was implemented.
- List the files created or modified.
- Mention commands used to run or test the application.
- Report any errors or incomplete features honestly.
- Do not change unrelated screens while fixing a feature.
- Check the application at mobile and desktop sizes.

## Project Completion

The completed application must support:

- Customer service browsing and queue registration.
- Daily sequential token generation.
- Customer queue tracking.
- Staff queue management.
- Live queue display.
- Admin service management.
- Realtime updates between screens.

Prepare the application for deployment and document the live URL in README.md when deployment is complete.
