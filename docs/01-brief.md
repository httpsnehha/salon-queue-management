
# Salon Queue Management System — Project Brief

## Problem

Salons often manage customers through manual registers and verbal communication. This can cause long waiting times, confusion about queue positions, and difficulty managing customer flow.

The Salon Queue Management System will digitize the salon queue process. Customers can join the queue, receive a token number, and track their waiting status, while salon staff can manage customers and services through a centralized dashboard.

## Users

1. Customers — Join the salon queue, select services, receive tokens, and track their queue status.
2. Receptionist / Staff — Register walk-in customers, manage the queue, and update customer service status.
3. Salon Owner / Admin — Manage salon services, prices, staff, and daily statistics.
4. Waiting Area Display — Show currently serving and upcoming customer tokens.

## Must-have Features

1. Display salon services with names, descriptions, categories, and prices.
2. Allow customers to join the queue by entering their name, phone number, and selected service.
3. Generate a unique sequential queue token for each customer every day.
4. Show customers their token number, queue position, status, and estimated waiting time.
5. Provide a staff dashboard to manage waiting, in-service, and completed customers.
6. Provide an admin dashboard to add, edit, delete, and manage salon services.
7. Display currently serving and upcoming tokens on a live queue display.
8. Automatically synchronize queue updates across customer, staff, and display screens.

## Don't Build

- Online payment gateway.
- Home service or doorstep salon booking.
- Customer social networking.
- Product shopping or e-commerce.
- Customer reviews and ratings.
- Complex loyalty and reward programs.
- Unnecessary features outside the salon queue management scope.

## Look and Feel

A modern, elegant, responsive salon application with a soft blush pink, cream, and dark charcoal colour palette, rounded cards, clean typography, and simple navigation.

The application must work smoothly on mobile phones, tablets, and desktop screens.

## Technology Stack

- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS
- Backend: Node.js + Express
- Database: SQLite
- Real-time updates: Socket.IO
- Version Control: Git and GitHub
- Deployment: Vercel and Render
