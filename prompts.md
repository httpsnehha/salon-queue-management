
# Project Prompts — Salon Queue Management System

This file records every prompt used during development, in chronological order.

## Prompt 1 — Understand the project

Read AGENTS.md and all files inside docs/.

Summarize the Salon Queue Management System in 8 bullet points. Identify any unclear requirements or contradictions. Do not write code yet.

## Prompt 2 — Project setup

Set up the React + Vite + TypeScript project with Tailwind CSS, Node.js + Express backend, SQLite database, and Socket.IO for realtime updates.

Follow AGENTS.md and the three project documents. First show the implementation plan and files you intend to create. Do not build the complete application in one step.

## Development prompt record

Add every prompt used during development below in the exact order, including prompts that fail or need correction.


## Prompt 1 — Understand the project

Read AGENTS.md and all three files inside docs/.

Summarize the Salon Queue Management System in 8 clear bullet points.

Identify:
1. The purpose of the application.
2. All user roles.
3. All six screens.
4. The main customer journey.
5. The queue status rules.
6. The technology stack.
7. Any unclear or contradictory requirements.
8. Your understanding of the final expected application.

Do not write or modify any code yet.

Do not invent additional features. Follow the project documents as the source of truth.


## Prompt 2 — Initial project setup

Read AGENTS.md and all files inside docs/ before starting.

Set up the initial Salon Queue Management System project using:

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS

Backend:
- Node.js
- Express
- SQLite
- Socket.IO

Requirements:

1. Create a clean frontend and backend folder structure.
2. Set up the React application.
3. Set up the Express backend.
4. Configure Tailwind CSS correctly.
5. Configure the SQLite database connection.
6. Configure Socket.IO for future realtime queue updates.
7. Create navigation between all six screens:
   - Customer Home and Services (/)
   - Join Queue (/join)
   - Customer Queue Status (/queue/:id)
   - Staff Dashboard (/staff)
   - Live Queue Display (/display)
   - Admin Dashboard (/admin)
8. Create empty but navigable screen layouts.
9. Use a consistent blush pink, cream, and dark charcoal salon theme.
10. Make the layout responsive for mobile and desktop.

Important:
- Do not implement the complete queue functionality yet.
- Do not add online payments or unrelated features.
- Do not use a different technology stack.
- Do not leave broken navigation links.
- Keep the code organized and beginner-friendly.

First show your implementation plan and the files you intend to create. Wait for approval before making changes.

After approval, implement only this setup task.

Finally, list the files created and modified and explain how to run the frontend and backend.

## Prompt 3 — Build Customer Home and Services page

Read AGENTS.md and all three documents inside docs/ before making changes.



Implement the Customer Home and Services screen at `/`.

### Requirements

1. Create an elegant, modern salon homepage using the existing blush pink, cream, and dark charcoal theme.
2. Add a welcome/hero section with the salon name and a short introduction.
3. Display salon services in attractive responsive cards.
4. Each service card should show:
   - Service name
   - Short description
   - Price
   - Estimated duration
   - A "Book / Join Queue" button
5. Add a section showing the current number of waiting customers. Until the backend queue functionality exists, display clearly identified sample data rather than pretending it is live.
6. Add a prominent "Join Queue" button that navigates to `/join`.
7. Ensure the page works on mobile, tablet, and desktop.
8. Keep the existing shared navigation and six routes working.
9. Use sample service data for now. Do not implement database operations or queue registration yet.
10. Do not add payment, reviews, shopping, or unrelated features.

### Important instructions

- Inspect the existing files before editing.
- Reuse existing components and styles where appropriate.
- Do not unnecessarily rewrite the project.
- Keep code beginner-friendly and organized.
- Do not break the other five routes.
- Follow the documented project requirements.

### After implementation

1. List the files changed.
2. Explain what was implemented.
3. Give the exact command to run the frontend.
4. Tell me how to test the homepage and its buttons.
5. Report any errors or incomplete features honestly.

# Prompt 4 — Customer Queue Registration

Read AGENTS.md and all three documents inside docs/ before making changes. Also inspect the existing frontend and backend code.

Implement the Customer Queue Registration feature.

## 1. Join Queue page

Complete the existing `/join` page.

Add a registration form containing:
- Customer name
- Phone number
- Service selection
- Selected service price and estimated duration

Add a Register / Join Queue button.

## 2. Form validation

- All fields must be required.
- Validate the customer's name.
- Validate the phone number.
- Require a valid service selection.
- Display understandable validation messages.
- Prevent duplicate submissions while a request is processing.

## 3. Backend and SQLite

Implement the required backend API and database operations.

- Save customer queue registrations in SQLite.
- Store customer name, phone number, service information, token number, date, status, and registration time.
- Use the existing database setup where possible.
- Preserve the selected service's name, price, and duration in the queue record.

## 4. Daily token generation

Follow the rules in docs/03-flows-rules.md:

- Tokens start at #001 each calendar day.
- Tokens increase sequentially.
- Cancelled tokens must not be reused.
- Failed registrations must not consume tokens.
- Handle simultaneous registrations safely using database transactions.

## 5. Registration confirmation

After successful registration, show:
- Customer name
- Selected service
- Token number
- Registration confirmation message
- Link to the customer's queue status page

## 6. Customer Queue Status page

Connect the existing `/queue/:id` page so that a customer can view their actual registration details.

Do not invent queue status transitions or additional business rules.

## 7. Testing

Test:
- Successful registration
- Missing required fields
- Invalid phone number
- Invalid service selection
- Sequential token generation
- Failed registration not consuming a token
- Data persistence after restarting the backend

## Important instructions

- Use the existing React, Vite, TypeScript, Tailwind v4, Express, SQLite, and Socket.IO stack.
- Keep the existing homepage design and navigation working.
- Do not add payment features or unrelated functionality.
- Do not replace the database technology.
- Do not hardcode customer registrations.
- Do not expose sensitive information.
- Keep the code beginner-friendly.

Before making changes, show your implementation plan and the files you intend to modify. Wait for approval.

After implementation, explain all changes and provide exact PowerShell commands to run and test the feature. Report any tests you could not perform honestly.

# Prompt 5 — Staff Queue Dashboard

Read AGENTS.md and all three documents inside docs/ before making changes. Inspect the existing frontend, backend, database schema, and queue registration implementation.

Implement the Staff Queue Dashboard at `/staff`.

## 1. Staff Dashboard UI

Create a responsive dashboard using the existing blush pink, cream, and dark charcoal theme.

Display queue entries in these sections:
- Waiting
- In Service
- Completed

Also account for Cancelled registrations according to the documented queue rules. If the documentation does not specify how cancelled entries should appear, explain your proposed approach in the implementation plan before coding.

Each queue entry should display:
- Token number
- Customer name
- Selected service
- Service duration
- Registration time
- Current status

## 2. Queue Management

Allow staff to perform only these documented status transitions:

- Waiting → In Service
- Waiting → Cancelled
- In Service → Completed

Requirements:
- Provide clear action buttons.
- Prevent invalid status transitions.
- Update the database when a status changes.
- Display understandable success and error messages.
- Prevent accidental repeated submissions.

## 3. Backend

Implement the required API endpoints.

- Retrieve queue entries.
- Update a customer's status.
- Validate all status transitions on the backend.
- Do not allow customers to update their own status.
- Preserve existing registration and token data.

## 4. Realtime updates

Use the existing Socket.IO setup to notify connected screens when a queue status changes.

Do not break the existing frontend API connection.

## 5. Testing

Test:
- Displaying queue entries.
- Waiting → In Service.
- Waiting → Cancelled.
- In Service → Completed.
- Rejection of invalid transitions.
- Persistence after restarting the backend.
- Realtime notification after a status update.

## Important instructions

- Follow the existing React, Vite, TypeScript, Tailwind v4, Express, SQLite, and Socket.IO stack.
- Keep the existing homepage, Join Queue, and Queue Status pages working.
- Do not add payment functionality or unrelated features.
- Do not change the token-generation rules.
- Keep the implementation beginner-friendly.
- Do not introduce authentication or additional roles unless required by the project documents.

## Before implementation

First provide:
1. Your implementation plan.
2. Files you intend to create or modify.
3. Your proposed treatment of Cancelled registrations.
4. The API endpoints you intend to add.

Wait for approval before changing files.

After implementation, provide changed files, exact run commands, and honest test results.



## Prompt 6 - Investigate Staff Dashboard refresh and Customer Queue Status

We have tested Prompt 5 (Staff Queue Dashboard) and the Live Queue Display.

Current observations:

1. The Live Queue Display at `/display` updates automatically when queue status changes.
2. The Staff Dashboard at `/staff` does not consistently update automatically; we have to refresh it to see queue changes.
3. The Customer Queue Status page at `/queue/demo` displays "Queue details unavailable. This queue registration could not be found."

Please investigate these issues before changing code.

Tasks:

- Inspect the Socket.IO connection and event listeners in `StaffPage.tsx`.
- Ensure the staff dashboard automatically refreshes its queue data when it receives the existing `queue:updated` event.
- Check that listeners are cleaned up correctly and avoid duplicate listeners.
- Inspect customer registration response, frontend navigation after successful registration, and `QueueStatusPage.tsx`.
- Ensure the registration flow navigates using the actual registration ID returned by the backend, not a placeholder such as `demo`.
- Verify the customer status API receives the correct ID and returns the corresponding registration.
- Preserve existing styling, authentication, database logic, and status transition rules.
- Do not introduce unrelated features or change the API contract unnecessarily.
- Add or update tests for the identified problems.
- Run backend tests and frontend/backend builds.
- Explain the root cause of each issue and list all changed files.

Do not claim that browser testing passed unless it was actually performed.

### Outcome

- Staff dashboard reconnect resync and request-version guard added.
- Removed hard-coded `/queue/demo` navigation link.
- Customer status navigation now uses the actual registration ID.
- Backend tests: 15 passed.
- Backend and frontend builds passed.
- Browser testing subsequently confirmed the customer route, staff automatic updates, and live display automatic updates.

Update the Live Queue Display navigation.



Read AGENTS.md and the existing app structure before making changes.



Problem:\
The shared navigation header is hidden on `/display`, which is good for TV presentation, but users have no visible way to navigate back to the rest of the application.



Requirements:

1. Keep the shared navigation header hidden on `/display`.
2. Add a small, clearly visible "← Back to Home" button in the top-left area of the display page.
3. Clicking it must navigate to `/` using the existing React Router navigation approach.
4. Style it subtly so it does not distract from the live queue or make the display unsuitable for TV screens.
5. Make sure it is accessible and works on mobile, tablet, and desktop.
6. Do not change the clock, connection indicator, queue data, Socket.IO behavior, or other existing functionality.
7. Do not add unrelated features.

Run the frontend build and relevant backend tests if applicable. Report changed files and verification results. Do not claim browser testing unless performed.