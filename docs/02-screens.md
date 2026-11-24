
# Salon Queue Management System — Screens & Features

## Screen 1: Customer Home and Services
**URL:** `/`

**User:** Customer  
**Goal:** Browse salon services and join the queue.

### Screen elements
- Salon name and logo area.
- Welcome message.
- Search bar to search services.
- Service categories such as Hair, Skin, Nails, and Grooming.
- Service cards showing service name, description, price, and estimated duration.
- Join Queue button on each service card.
- Queue information showing the number of customers currently waiting.

### Actions
- Search filters the displayed services.
- Selecting a service opens the queue registration screen.
- Join Queue takes the customer to the registration form.

### Responsive design
- Mobile: one-column service cards.
- Desktop: multiple service cards in a grid.
- Buttons must be easy to tap.

### States
- Loading: show service loading placeholders.
- Empty: show "No services available".
- Error: show a message if services cannot be loaded.

---

## Screen 2: Join Queue
**URL:** `/join`

**User:** Customer  
**Goal:** Register for a salon service.

### Screen elements
- Selected service name.
- Service price and estimated duration.
- Customer name field.
- Phone number field.
- Selected service summary.
- Confirm and Join Queue button.
- Back button.

### Actions
- Customer enters their name and phone number.
- Customer confirms the selected service.
- The system creates a queue entry and generates a token.
- Customer is redirected to the Queue Status screen.

### Validation
- Name is required.
- Phone number is required.
- Invalid phone number should show a helpful error.
- Prevent accidental repeated submissions.

### Responsive design
- Form should fit mobile screens without horizontal scrolling.
- On desktop, keep the form centered with a reasonable maximum width.

### States
- Loading while registration is being submitted.
- Error if registration fails.
- Success when a token is generated.

---

## Screen 3: Customer Queue Status
**URL:** `/queue/:id`

**User:** Customer  
**Goal:** Track their queue position and service status.

### Screen elements
- Large token number, for example #012.
- Customer name.
- Selected service.
- Current status.
- Current queue position.
- Approximate waiting time.
- Progress indicator:
  Waiting → In Service → Completed.
- Refresh or return-home option.

### Actions
- Queue information updates automatically when staff changes the status.
- Customer can see their current position and estimated waiting time.
- Show a completion message when the service is finished.

### Responsive design
- Token number should be large and easy to read.
- Status information should appear in clear cards.
- Layout must work on mobile and desktop.

### States
- Loading while queue information is retrieved.
- Error if the queue entry cannot be found.
- Clear message if the queue entry is unavailable.

---

## Screen 4: Staff Queue Dashboard
**URL:** `/staff`

**User:** Receptionist / Salon Staff  
**Goal:** Manage customers waiting for services.

### Screen elements
- Dashboard heading.
- Summary cards for Waiting, In Service, and Completed.
- Three queue sections:
  1. Waiting
  2. In Service
  3. Completed
- Each customer card displays:
  - Token number
  - Customer name
  - Selected service
  - Approximate waiting time
  - Time joined

### Actions
- Start Service button moves a waiting customer to In Service.
- Complete Service button moves an in-service customer to Completed.
- Updates should appear on the customer status screen automatically.
- Staff can view the queue in token order.

### Responsive design
- Desktop: three clear columns.
- Mobile: sections stacked vertically.
- Buttons must be large enough to tap.

### States
- Show "No customers waiting" when the waiting list is empty.
- Show loading while queue data is retrieved.
- Show an error message if the queue cannot be loaded.

---

## Screen 5: Live Queue Display
**URL:** `/display`

**User:** Customers in the salon waiting area  
**Goal:** Show which token is currently being served and which customers are waiting.

### Screen elements
- Salon name at the top.
- Large "Now Serving" section.
- Currently serving token number.
- Upcoming queue tokens.
- Service status information.
- Simple clock or date display.

### Actions
- Display updates automatically when staff changes queue status.
- Completed customers are removed from the active queue display.

### Responsive design
- Designed primarily for a large TV or monitor.
- Use large text and high contrast.
- Keep the screen readable from a distance.

### States
- Show "No customers currently waiting" when the queue is empty.
- Show a loading message while queue information is retrieved.

---

## Screen 6: Admin Dashboard and Service Manager
**URL:** `/admin`

**User:** Salon Owner / Admin  
**Goal:** Manage salon services and view daily queue information.

### Screen elements
- Dashboard heading.
- Summary cards:
  - Total customers today
  - Waiting customers
  - Customers in service
  - Completed services
- Service management table.
- Service name, category, description, price, and duration.
- Add Service button.
- Edit and Delete actions.

### Actions
- Add Service opens a form to create a service.
- Edit allows the admin to update service details.
- Delete removes a service after confirmation.
- Changes to services should appear on the customer services screen.
- Summary cards display current daily statistics.

### Validation
- Service name is required.
- Price must be a valid non-negative amount.
- Duration must be a valid positive number.

### Responsive design
- Desktop: table layout.
- Mobile: service cards or a horizontally manageable layout.
- Forms must remain usable on small screens.

### States
- Show "No services added yet" if the service list is empty.
- Show loading while data is retrieved.
- Show helpful errors when an action fails.

---

## Overall Design Rules
- Use a modern salon theme.
- Main colours: blush pink, cream, and dark charcoal.
- Use consistent typography, spacing, cards, and buttons.
- Keep navigation simple.
- Make all screens mobile-friendly.
- Use clear status colours consistently.
- Do not add features outside the project brief.
