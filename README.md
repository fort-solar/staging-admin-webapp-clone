Fortsolar Admin
===============

Admin dashboard for Fortsolar. This app is where the Fortsolar team will manage users, receive requests, send quotes, assign installers to customers, and more.

Getting Started
---------------

Install dependencies:

```bash
npm install
```

Run the development server on port 3326:

```bash
npm run dev
```

Open `http://localhost:3326` in your browser.

Environment
-----------

Create a local env file before running the dashboard:

```bash
cp .env.example .env.local
```

For OneSignal browser notifications, set:

- `ONESIGNAL_APP_ID` and `ONESIGNAL_SAFARI_WEB_ID` for local development
- `NEXT_PUBLIC_ONESIGNAL_APP_ID` and `NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID` for production builds
- `ONESIGNAL_NOTIFY_BUTTON=true` in development, or `NEXT_PUBLIC_ONESIGNAL_NOTIFY_BUTTON=true` in production, only if you want OneSignal's floating notify button enabled
