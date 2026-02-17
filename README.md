# MyBuilding - Smart Building Management App

A comprehensive PWA for residential building management with bilingual support (Hebrew/English).

## Features

### For Residents
- **Dashboard** - Payment status, quick actions, recent notices
- **Maintenance Center** - Report issues with photo upload, track status
- **Notice Board** - Building announcements, events with RSVP
- **Community Hub** - Voting, trusted professionals, marketplace

### For Admins
- **Financial Dashboard** - Income/expenses overview with charts
- **Debtors Tracker** - Send payment reminders
- **Expense Manager** - Log expenses with receipt uploads
- **User Management** - Approve/reject new residents

## Tech Stack
- React 18
- Pure CSS (no frameworks)
- PWA-ready with manifest.json
- RTL/LTR support
- Mobile-first responsive design

## Pages

| File | Description |
|------|-------------|
| `index.html` | Resident Dashboard |
| `auth.html` | Login/Registration flow |
| `faults.html` | Maintenance ticket system |
| `notices.html` | Notice board with events |
| `community.html` | Voting, pros, marketplace |
| `profile.html` | User profile & settings |
| `admin.html` | Admin dashboard |

## Design System

### Colors
- Primary: `#D4785C` (Terracotta)
- Secondary: `#2D5A4A` (Forest Green)
- Background: `#FFF9F5` (Cream)

### Typography
- Display: Fraunces
- Body: Rubik (excellent Hebrew support)

## Getting Started

1. Clone the repository
2. Set environment variables from `.env.example`
3. Run `node scripts/generate-config.js` to build `public/config.js`
4. Open any `.html` file in a browser
5. Use mobile view (375px) for best experience

## Supabase Setup

Run migrations in order inside Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_photo_retention.sql`
3. `supabase/migrations/003_storage_and_profile_security.sql`
4. `supabase/migrations/004_admin_invites.sql`

After first admin user signs up, set them as admin once:

```sql
UPDATE public.profiles
SET is_admin = TRUE, is_approved = TRUE
WHERE email = 'your-admin-email@example.com';
```

## Photo Retention (30 days)

Fault photos can now be auto-cleaned after 30 days, unless explicitly preserved.

1. Run migration `supabase/migrations/002_photo_retention.sql` in Supabase SQL Editor.
2. Schedule the cleanup function once per day (optional cron snippet is inside that migration).
3. Preserve a specific fault's photos by setting `preserve_photos = true`.

Useful SQL examples:

```sql
-- Keep photos for one fault forever
UPDATE public.faults
SET preserve_photos = TRUE
WHERE id = 'FAULT_UUID_HERE';

-- Return to normal retention (30 days from now)
UPDATE public.faults
SET preserve_photos = FALSE
WHERE id = 'FAULT_UUID_HERE';

-- Manual cleanup run (if needed)
SELECT public.cleanup_expired_fault_photos(500);
```

Client helper methods were added in `public/supabase.js`:
- `AppAuth.setFaultPhotoPreservation(faultId, true|false)`
- `AppAuth.getFaultPhotoRetentionStatus()`

## Push Notifications

Push is connected through OneSignal:

1. Set `VITE_ONESIGNAL_APP_ID` for web subscription prompts.
2. Set `ONESIGNAL_REST_API_KEY` in Vercel environment variables.
3. Admin notice publish now also calls `/api/send-push` to broadcast to subscribed users.

## For Lovable

This project is designed to be imported into Lovable. The HTML files are self-contained with embedded React via CDN, making them easy to convert to Lovable's component structure.

## License

MIT
