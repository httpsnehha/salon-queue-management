
# Salon Queue Management System — Flows & Rules

## 1. Main Customer Flow

1. Customer opens the salon website.
2. Customer browses the available salon services.
3. Customer selects a service.
4. Customer enters their name and phone number.
5. Customer clicks Confirm and Join Queue.
6. The system creates a queue entry.
7. The system generates a unique daily token number.
8. Customer is redirected to the Queue Status screen.
9. Customer can view their token, queue position, and estimated waiting time.
10. When staff starts the service, the status changes to In Service.
11. When staff finishes, the status changes to Completed.

## 2. Staff Flow

1. Staff opens the Staff Dashboard.
2. Staff views customers in the Waiting section.
3. Staff selects Start Service for the next customer.
4. The customer moves to In Service.
5. Staff selects Complete Service after finishing the service.
6. The customer moves to Completed.
7. All relevant screens update automatically.

## 3. Admin Flow

1. Admin opens the Admin Dashboard.
2. Admin views daily queue statistics.
3. Admin can add a new salon service.
4. Admin can edit an existing service.
5. Admin can delete a service after confirmation.
6. Updated services are reflected on the customer services screen.

## 4. Queue Status Rules

A queue entry can have only these statuses:

- Waiting
- In Service
- Completed
- Cancelled

Allowed status changes:

- Waiting → In Service
- Waiting → Cancelled
- In Service → Completed

Rules:
- A completed queue entry cannot return to Waiting.
- A cancelled queue entry cannot return to Waiting.
- Only staff can change queue statuses.
- Customers can view their status but cannot change it.
- Each queue entry must belong to one selected service.

## 5. Token Number Rules

- Every successful queue registration receives a token.
- Tokens are sequential within each calendar day.
- The first token of a new day starts at 001.
- A token must not be duplicated on the same day.
- Failed registrations must not consume a token.
- Cancelled tokens are not reused.
- Token numbers should be displayed consistently, for example #001, #002, and #003.

## 6. Waiting Time Rules

- Each service has an estimated duration configured by the admin.
- Waiting time is an approximate estimate, not a guaranteed appointment time.
- Estimate waiting time using the total estimated duration of customers ahead in the queue.
- Customers already in service should be considered when estimating the remaining wait.
- The estimate should update when queue statuses change.
- Clearly label the value as an approximate waiting time.

## 7. Important Edge Cases

### Invalid customer details
- Do not create a queue entry if the name or phone number is missing.
- Show a clear validation message.

### Duplicate submission
- Disable the submit button while registration is processing.
- Do not create two queue entries from one repeated submission.

### No available services
- Display a friendly message when no services are available.
- Do not allow customers to join a queue without selecting a service.

### Service deleted
- Do not allow a customer to register for a service that is no longer available.
- Existing queue entries must retain their original service information.

### Empty queue
- Staff dashboard should show an empty-state message.
- Live display should show that no customers are waiting.

### Missing queue entry
- Show a helpful message if a customer opens an invalid or unavailable queue link.

### Realtime updates
- Customer status, staff dashboard, and live display should stay synchronized.
- If a connection is lost, show a connection warning and recover when possible.

## 8. Test Checklist

- [ ] Customer can view the available salon services.
- [ ] Customer can select a service and open the registration form.
- [ ] Empty customer name is rejected.
- [ ] Invalid or missing phone number is rejected.
- [ ] Successful registration generates a unique token.
- [ ] Two registrations receive different sequential tokens.
- [ ] Customer can view their queue status and position.
- [ ] Staff can move a customer from Waiting to In Service.
- [ ] Staff can move a customer from In Service to Completed.
- [ ] Customer status updates without manually refreshing the page.
- [ ] Admin can add, edit, and delete a service.
- [ ] Updated services appear on the customer services screen.
- [ ] Live display updates when queue status changes.
- [ ] The main flow works on a mobile-sized screen.

## 9. Important Project Boundaries

- No online payment gateway.
- No home-service booking.
- No product shopping.
- No customer reviews or ratings.
- No loyalty or reward system.
- Keep the application focused on salon services and queue management.


## Current implemented workflow (supersedes the earlier status flow above)

The current queue status flow is Waiting, then Called, then In chair, then Done. A waiting entry may instead become **Cancelled**, and a Called entry becomes **No-show** if it has not started within 10 minutes. Status changes are validated by the backend. Tokens remain issued after cancellation or no-show and are never reused. A returning no-show customer must be registered again and receives a new token.

Reception selects an on-duty barber and calls the earliest eligible Waiting customer who selected that barber or Any. A specific barber preference is never reassigned. A barber cannot have more than one customer In chair. Barbers on break cannot receive new calls.

Online queue joining can be Open or Closed. Closing applies to online customer registration; authenticated reception staff may still create walk-in registrations. Active services are loaded from SQLite and deactivated services cannot receive new registrations. Queue entries retain service name, Gujarati name, price, and duration snapshots.

Service start and completion timestamps are stored. Today's served count is the number of Done entries; average wait uses valid registration-to-service-start durations for Done entries; no-shows count actual No-show entries. The calendar day uses `QUEUE_TIME_ZONE`, defaulting to `Asia/Kolkata`.

Owner and reception management APIs use the existing staff access-code session. Barber View uses that same session and is not a separate account system. Queue, settings, service, and barber changes are broadcast through Socket.IO after their database writes commit.
