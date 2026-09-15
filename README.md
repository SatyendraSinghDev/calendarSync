# Shared Calendar & Conflict Detection App

This project demonstrates an end-to-end shared calendar workflow with:

- React + TypeScript frontend
- Node.js + Express backend
- Google OAuth / Calendar API integration hooks
- Conflict detection engine
- Combined calendar view for multiple users
- Free-slot availability analysis
- MongoDB-ready storage with demo fallback

## Features

- Connect Google accounts with OAuth 2.0
- Fetch and normalize events from Google Calendar
- Detect overlapping events across users
- Show shared free time windows
- Highlight interview and meeting conflicts
- Show an empty calendar until a Google account is connected

## Tech stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express
- Database: MongoDB (optional via Mongoose, with demo fallback)
- Auth: Google OAuth 2.0

## Quick start

1. Install dependencies:

   npm install

2. Copy environment variables:

   copy .env.example .env

3. Update Google OAuth values in .env if you want real Google integration.

4. Start the app:

   npm run dev

5. Open the frontend:

   http://localhost:5173

## Available API endpoints

- GET /api/health
- GET /api/auth/google-url
- GET /api/auth/google/callback
- GET /api/calendar?date=2026-09-15
- GET /api/conflicts?date=2026-09-15
- GET /api/availability?date=2026-09-15

## Google connection requirement

The calendar never displays fabricated events. Until Google OAuth is completed, it shows an empty calendar and asks you to connect Google Calendar. After consent, events are fetched from the connected account's primary Google Calendar.

## Production setup

For a real deployment, configure:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI
- MONGODB_URI

Then connect the app to the Google Calendar API using the OAuth access token for each user.
