// EXAMPLE CONFIGURATION - Copy this file to config.js and fill in your values
// config.js should NOT be committed to git (it's in .gitignore)
//
// IMPORTANT: Supabase credentials should be set as Environment Variables:
// - In Vercel: Dashboard > Settings > Environment Variables
// - For local dev: Create .env.local file (see .env.example)
//
window.APP_CONFIG = {
  // Main admin email (has full access to everything)
  ADMIN_EMAIL: "your-email@example.com",

  // List of additional admin emails
  ADMIN_EMAILS: [],

  // Building configuration
  BUILDING_NAME: "שם הבניין",
  BUILDING_NAME_EN: "Building Name",
  BUILDING_ADDRESS: "כתובת הבניין",
  BUILDING_ADDRESS_EN: "Building Address",

  // Invitation secret (used to generate secure invitation links)
  // Generate a random string for security
  INVITATION_SECRET: "change-this-to-random-string",

  // Push notifications via OneSignal (optional)
  ONESIGNAL_APP_ID: ""
};
