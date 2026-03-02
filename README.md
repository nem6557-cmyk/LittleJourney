# LittleJourney

A modern daycare management app that keeps parents connected to their child's day. Built with React Native (Expo), Supabase, Stripe, and Sentry.

## Features

### For Parents
- **Live Timeline** &mdash; Real-time feed of meals, naps, activities, milestones, and photos
- **Daily Reports** &mdash; End-of-day narrative summaries with stats and highlights
- **Messaging** &mdash; Secure, encrypted conversations with caregivers and admins
- **Photo Gallery** &mdash; Browse and download photos grouped by month
- **Invoices & Payments** &mdash; View tuition invoices, pay via Stripe, manage payment methods
- **Push Notifications** &mdash; Instant alerts for milestones, incidents, and messages

### For Caregivers
- **Activity Logging** &mdash; Log meals, naps, diaper changes, activities, and incidents
- **Attendance** &mdash; Check-in / check-out with status tracking
- **Child Profiles** &mdash; View allergies, emergency contacts, and authorized pickups
- **Photo Uploads** &mdash; Capture and share photos directly from the app

### For Admins
- **Dashboard** &mdash; Overview of attendance, enrollment, and daily activity stats
- **Child Management** &mdash; Add, search, and manage enrolled children
- **Staff Management** &mdash; Invite caregivers and assign roles
- **Subscription Plans** &mdash; Starter, Professional, and Enterprise tiers via Stripe

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo 54 / React Native 0.81 / React 19 |
| Language | TypeScript 5.9 |
| Backend | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) |
| Payments | Stripe (React Native SDK + Stripe Connect) |
| Monitoring | Sentry (React Native SDK) |
| State | React Context + React Query |
| Navigation | React Navigation (Bottom Tabs + Stack) |
| Validation | Zod 4 |
| Testing | Jest + ts-jest (84 unit tests) |
| Linting | ESLint + Prettier |

## Project Structure

```
src/
  components/      # Reusable UI (EmptyState, ErrorBoundary, LoadingSkeleton)
  context/         # AuthContext, AppContext (global state)
  data/            # Sample/demo data
  hooks/           # React Query wrappers (useTimeline, useMessages, etc.)
  lib/             # Core utilities (config, offline, stripe, sentry, analytics, notifications, validators)
  navigation/      # AppNavigator (tabs + stacks + deep linking)
  screens/
    admin/         # AdminDashboard, ManageChildren, ManageStaff
    auth/          # Login, SignUp, ForgotPassword, ResetPassword
    caregiver/     # CaregiverDashboard
    legal/         # ConsentScreen (COPPA)
    parent/        # Timeline, DailyReport, Gallery
    payments/      # Subscription, PaymentMethods, InvoiceDetail
    shared/        # Messages, Profile
  services/        # Supabase query layer (auth, timeline, messages, etc.)
  theme/           # Colors, spacing, typography, shadows
  types/           # TypeScript type definitions
  utils/           # Helper functions (formatTime, getChildAge, etc.)
supabase/
  migrations/      # SQL schema + RLS policies
  functions/       # Edge Functions (send-push, create-checkout, etc.)
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A Supabase project (free tier works)
- A Stripe account (test mode for development)

### Installation

```bash
# Clone the repository
git clone https://github.com/nem6557-cmyk/LittleJourney.git
cd LittleJourney

# Install dependencies
npm install

# Copy environment template and fill in your keys
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
EXPO_PUBLIC_ENV=development
```

### Running the App

```bash
# Start Expo dev server
npm start

# Run on specific platform
npm run ios
npm run android
npm run web
```

### Development Commands

```bash
# Run tests
npm test
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Database Setup

Apply the Supabase migrations in order:

```bash
# Using Supabase CLI
supabase db push
```

Or manually run the SQL files in `supabase/migrations/` through the Supabase SQL Editor.

## Deployment

### Mobile (EAS Build)

```bash
# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Web

```bash
# Export static web build
npx expo export --platform web
```

## Architecture Highlights

- **Offline-First**: Mutations are queued locally and synced when connectivity returns, with exponential backoff retry
- **Real-Time**: Supabase Realtime subscriptions for live timeline updates and messaging
- **Row-Level Security**: All database tables have RLS policies enforcing role-based access
- **COPPA Compliant**: Parental consent flow required before accessing child data
- **Error Boundaries**: Root-level ErrorBoundary catches and displays crashes gracefully
- **Deep Linking**: `littlejourney://` and `https://littlejourney.app` URL schemes configured

## License

Private &mdash; All rights reserved.
