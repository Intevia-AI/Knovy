# Waitlist-to-Beta Conversion System Implementation

## Overview

This document describes the implementation of the waitlist-to-beta conversion system for Knovy, which allows administrators to send beta invitation emails to waitlist users and automatically converts them to beta tier when they first log in.

## System Architecture

### Flow Diagram

```
Waitlist User → Admin Dashboard → Send Beta Invitation Email
             ↓
       Receives Email with Download Link
             ↓
       Downloads and Installs App
             ↓
       First Login (Auth)
             ↓
       Auto-Conversion Trigger (if email in invited waitlist)
             ↓
       Profile Created with 'beta' Role
             ↓
       Full Beta Access Enabled
```

## Implementation Components

### 1. Database Changes

#### Migration: `20251028120000_add_beta_invitation_tracking.sql`

**Location:** `supabase/migrations/20251028120000_add_beta_invitation_tracking.sql`

**Changes:**
- Added 4 new columns to `waitlist` table:
  - `invited_to_beta` (BOOLEAN) - Tracks if invitation email has been sent
  - `invited_at` (TIMESTAMPTZ) - Timestamp when invitation was sent
  - `converted_to_beta` (BOOLEAN) - Tracks if user has logged in and been converted
  - `converted_at` (TIMESTAMPTZ) - Timestamp of role conversion
- Created indexes for efficient queries:
  - `idx_waitlist_email_invited` on `(email, invited_to_beta)`
  - `idx_waitlist_invited_to_beta` on `invited_to_beta` (partial index)
- Added RLS policies for admin access to waitlist management

#### Migration: `20251028130000_enhance_auto_beta_conversion.sql`

**Location:** `supabase/migrations/20251028130000_enhance_auto_beta_conversion.sql`

**Changes:**
- Enhanced `handle_new_user()` trigger function with waitlist check logic
- When a new user signs up:
  1. Checks if email exists in waitlist with `invited_to_beta = true` and `converted_to_beta = false`
  2. If found, creates profile with `'beta'` role instead of `'free'`
  3. Updates waitlist record to mark as converted with timestamp
  4. Otherwise, creates profile with default `'free'` role
- Ensures idempotent trigger creation

### 2. Backend: Supabase Edge Functions

#### Function: `send-beta-invitation`

**Location:** `supabase/functions/send-beta-invitation/index.ts`

**Endpoints:**

1. **POST `/send-beta-invitation`** - Send beta invitations
   - Protected by `withRBAC('admin:read_users')`
   - Request body:
     ```typescript
     {
       emails: string[];        // Array of email addresses
       locale: 'en' | 'zh-TW'   // Email language
     }
     ```
   - Response:
     ```typescript
     {
       message: string;
       summary: {
         total: number;
         successful: number;
         failed: number;
         alreadyInvited: number;
       };
       results: {
         success: string[];
         failed: { email: string; error: string }[];
         alreadyInvited: string[];
       }
     }
     ```

2. **GET `/send-beta-invitation/waitlist`** - Fetch all waitlist users
   - Protected by `withRBAC('admin:read_users')`
   - Returns full waitlist with invitation and conversion status

**Features:**
- Validates email format before sending
- Checks if email exists in waitlist
- Prevents duplicate invitations by checking `invited_to_beta` flag
- Updates waitlist record after successful email send
- Comprehensive error handling and reporting
- Supports batch processing of multiple emails

#### Email Template: `beta-invitation.tsx`

**Location:** `supabase/functions/send-beta-invitation/emails/beta-invitation.tsx`

**Features:**
- Bilingual support (English + Traditional Chinese)
- Professional branded design matching existing email templates
- Includes:
  - Welcome message and congratulations
  - List of beta features (unlimited transcription, AI actions, etc.)
  - Download button with link to app
  - Getting started instructions
  - Note about automatic beta activation on first login
  - Support contact information
  - Footer with unsubscribe context
- Uses `@react-email/components` for consistent rendering
- Responsive design with proper styling

### 3. Frontend: Admin Dashboard

#### New Page: Waitlist Management

**Location:** `apps/admin-dashboard/app/waitlist/page.tsx`

Simple page wrapper that includes `AuthGuard` and `DashboardLayout` with `WaitlistTable` component.

#### Component: `WaitlistTable`

**Location:** `apps/admin-dashboard/components/WaitlistTable.tsx`

**Features:**
- Displays all waitlist users with comprehensive status information
- Columns:
  - Checkbox for bulk selection (only for uninvited users)
  - Email address
  - Joined date
  - Invitation status (Invited/Pending badge)
  - Invited at timestamp
  - Conversion status (Converted/Not Yet badge)
  - Converted at timestamp
  - Individual send invitation button
- Summary statistics at the top:
  - Total waitlist users
  - Invited count
  - Converted count
  - Pending count
- Bulk actions:
  - Select all uninvited users
  - Bulk send invitations button (appears when emails selected)
- Individual actions:
  - Send invitation button per user (only for uninvited)
- Real-time data fetching from Edge Function
- Auto-refresh after sending invitations
- Professional UI with badges and icons from `lucide-react`

#### Component: `SendInvitationDialog`

**Location:** `apps/admin-dashboard/components/SendInvitationDialog.tsx`

**Features:**
- Modal dialog for sending beta invitations
- Displays recipient list (scrollable for bulk sends)
- Language selector (English / 繁體中文)
- **Email preview button** - View email design before sending
- Loading states with spinner
- Comprehensive result display:
  - Success alert (green) showing count of successful sends
  - Already invited alert (yellow) for duplicate attempts
  - Failed alert (red) with detailed error messages per email
- Auto-closes after successful send (all succeeded)
- Prevents accidental closure during sending
- Uses `@workspace/ui` components for consistency

#### Component: `EmailPreviewDialog`

**Location:** `apps/admin-dashboard/components/EmailPreviewDialog.tsx`

**Features:**
- Full email preview with actual HTML rendering
- Language switcher to preview both English and Traditional Chinese versions
- Shows email metadata (From, To, Subject)
- Exact replica of the email template with all styling
- Displays sample recipient email
- Responsive design for easy review
- Info box explaining preview functionality
- Accessible from both WaitlistTable and SendInvitationDialog

#### Navigation Update

**Location:** `apps/admin-dashboard/components/DashboardLayout.tsx`

**Changes:**
- Added `Mail` icon import from `lucide-react`
- Split navigation items into two groups:
  - `managementNavItems`: User Management + **Waitlist** (new)
  - `analyticsNavItems`: All analytics pages
- Added "Waitlist" navigation item with Mail icon under Management section
- Updated nav rendering to iterate over both groups separately

## Usage Instructions

### For Administrators

#### Sending Beta Invitations

1. **Access Waitlist Management**
   - Log in to admin dashboard
   - Navigate to "Waitlist" in the Management section

2. **Review Waitlist**
   - View all waitlist users with their status
   - Check summary statistics at the top
   - Identify uninvited users (Pending badge)

3. **Preview Email Design (Optional but Recommended)**
   - Click "Preview Email" button at the top right of the page
   - OR click "Preview Email" in the send invitation dialog
   - Review the email design in both languages
   - Switch between English and 繁體中文
   - Check email content, formatting, and styling
   - Close preview when satisfied

4. **Send Individual Invitation**
   - Click "Send" button next to the user's email
   - Select email language (English or 繁體中文)
   - (Optional) Click "Preview Email" to review before sending
   - Review recipient details
   - Click "Send Invitations"
   - Wait for confirmation

5. **Send Bulk Invitations**
   - Check the boxes next to users you want to invite
   - Or click the header checkbox to select all uninvited users
   - Click "Send Invitations (X)" button at the top
   - Select email language
   - (Optional) Click "Preview Email" to review before sending
   - Review recipient list
   - Click "Send Invitations"
   - Review results summary

6. **Track Conversion**
   - Monitor the "Conversion Status" column
   - Users marked as "Converted" have successfully logged in
   - "Converted At" shows when they first logged in

#### Understanding Status Badges

- **Invitation Status:**
  - ✓ Invited (blue badge) - Email has been sent
  - ✗ Pending (gray badge) - Email not yet sent

- **Conversion Status:**
  - ✓ Converted (green badge) - User has logged in and received beta role
  - ✗ Not Yet (outline badge) - User hasn't logged in yet

### For Users

1. **Receive Invitation Email**
   - Check inbox for email from info@intevia.app
   - Subject: "You're invited to Knovy Beta!" / "您已被邀請加入 Knovy Beta！"

2. **Download App**
   - Click "Download Knovy" button in email
   - Install the application

3. **First Login**
   - Open Knovy app
   - Sign in with the email address that received the invitation
   - Beta role is automatically assigned on first login

4. **Verify Beta Access**
   - Check available features in the app
   - All AI actions should be unlocked
   - No transcription time limits

## Technical Details

### Database Trigger Logic

```sql
-- Simplified trigger function logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_waitlist_record RECORD;
BEGIN
  v_email := NEW.email;

  -- Check waitlist
  SELECT * INTO v_waitlist_record
  FROM public.waitlist
  WHERE email = v_email
    AND invited_to_beta = true
    AND converted_to_beta = false;

  IF FOUND THEN
    -- Create beta profile
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'beta');

    -- Mark as converted
    UPDATE public.waitlist
    SET converted_to_beta = true, converted_at = NOW()
    WHERE email = v_email;
  ELSE
    -- Create free profile
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'free');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Security Considerations

1. **RBAC Protection**
   - All admin endpoints protected by `withRBAC` middleware
   - Only users with `admin` role can access waitlist management
   - Service role key used for database operations (bypasses RLS)

2. **RLS Policies**
   - Admins can read and update waitlist entries
   - Regular users cannot access waitlist table
   - Prevents unauthorized invitation sending

3. **Email Validation**
   - Format validation before sending
   - Existence check in waitlist database
   - Prevention of duplicate sends via status flags

4. **Database Security**
   - Trigger function uses SECURITY DEFINER to ensure proper execution
   - Atomic operations for conversion tracking
   - Indexed queries for performance

### Environment Requirements

- **Supabase:**
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

- **Resend (Email Service):**
  - `RESEND_API_KEY`
  - Configured sender: info@intevia.app

- **Admin Dashboard:**
  - `NEXT_PUBLIC_SUPABASE_URL`

## Testing Checklist

### Database Testing

- [x] Run migration `20251028120000_add_beta_invitation_tracking.sql`
- [ ] Verify waitlist table has new columns
- [ ] Test admin RLS policies (read/update access)
- [ ] Run migration `20251028130000_enhance_auto_beta_conversion.sql`
- [ ] Verify trigger function is updated

### Backend Testing

- [ ] Deploy `send-beta-invitation` Edge Function
- [ ] Test GET `/waitlist` endpoint (fetch waitlist)
- [ ] Test POST `/` endpoint with single email
- [ ] Test POST `/` endpoint with multiple emails
- [ ] Verify RBAC protection (non-admin should be denied)
- [ ] Test email rendering (both EN and zh-TW)
- [ ] Verify Resend API integration

### Frontend Testing

- [ ] Navigate to `/waitlist` in admin dashboard
- [ ] Verify waitlist data loads correctly
- [ ] Test individual send invitation
- [ ] Test bulk selection and send
- [ ] Verify status badges display correctly
- [ ] Test language selection in dialog
- [ ] Verify success/error messages
- [ ] Test auto-refresh after sending

### Integration Testing

- [ ] Add test email to waitlist via web form
- [ ] Send beta invitation via admin dashboard
- [ ] Verify invitation email received
- [ ] Create new auth user with invited email
- [ ] Verify profile created with `beta` role (not `free`)
- [ ] Verify waitlist record marked as converted
- [ ] Check app features are unlocked for beta user

### Edge Case Testing

- [ ] Attempt to send invitation to non-waitlist email
- [ ] Attempt to send duplicate invitation
- [ ] Test with invalid email format
- [ ] Test with user who already has `pro` or `admin` role
- [ ] Test concurrent invitation sends
- [ ] Test with empty email list

## Deployment Steps

1. **Database Migrations**
   ```bash
   # Apply migrations to Supabase remote
   supabase db push
   ```

2. **Deploy Edge Functions**
   ```bash
   # Deploy the new function
   supabase functions deploy send-beta-invitation
   ```

3. **Deploy Admin Dashboard**
   ```bash
   # Build and deploy admin dashboard
   cd apps/admin-dashboard
   pnpm build
   # Deploy to hosting (Vercel, etc.)
   ```

4. **Verify Environment Variables**
   - Ensure all required env vars are set in Supabase
   - Verify Resend API key is configured
   - Check CORS settings for admin dashboard origin

## Monitoring and Maintenance

### Metrics to Track

- Number of invitations sent per day
- Conversion rate (invited → logged in)
- Time between invitation and first login
- Failed email deliveries
- Duplicate invitation attempts

### Logs to Monitor

- Edge Function logs for `send-beta-invitation`
- Database trigger logs (RAISE NOTICE in trigger function)
- Email delivery status from Resend
- Admin dashboard API errors

### Maintenance Tasks

- Regularly review waitlist conversion status
- Clean up old waitlist entries (optional)
- Monitor Resend API quota and billing
- Update email templates as needed
- Adjust beta entitlements if features change

## Future Enhancements

### Potential Improvements

1. **Email Scheduling**
   - Schedule invitation sends for specific times
   - Drip campaign support for staged rollout

2. **User Segmentation**
   - Filter waitlist by join date
   - Tag users for targeted invitations
   - A/B test different email templates

3. **Analytics Dashboard**
   - Conversion funnel visualization
   - Time-to-activation metrics
   - Email engagement tracking (opens, clicks)

4. **Automated Reminders**
   - Send follow-up emails to users who haven't logged in
   - Re-engagement campaigns for inactive beta users

5. **Download Link Management**
   - Track download counts per invitation
   - Personalized download links
   - Platform-specific download buttons (macOS, Windows)

6. **Waitlist Priority System**
   - VIP tier for early adopters
   - Referral bonus for inviting friends
   - Priority queue based on engagement

## Troubleshooting

### Common Issues

#### Invitations Not Sending

- **Check:** Resend API key is valid and has quota
- **Check:** Email is in waitlist table
- **Check:** User has admin role in profiles table
- **Check:** Edge Function logs for errors

#### User Not Auto-Converted to Beta

- **Check:** Email in invitation matches auth email exactly (case-sensitive)
- **Check:** `invited_to_beta = true` in waitlist for that email
- **Check:** `converted_to_beta = false` before login
- **Check:** Trigger function is deployed and enabled
- **Check:** Database logs (RAISE NOTICE) in Supabase logs

#### Admin Dashboard Not Loading Waitlist

- **Check:** User is logged in as admin
- **Check:** Network requests to Edge Function
- **Check:** CORS configuration for admin dashboard origin
- **Check:** Supabase URL and anon key are correct

#### Duplicate Badge/Status Issues

- **Check:** Database schema matches latest migration
- **Check:** Indexes are created properly
- **Check:** RLS policies allow admin read access

## References

- Supabase Documentation: https://supabase.com/docs
- Resend API Documentation: https://resend.com/docs
- React Email Documentation: https://react.email/docs
- Knovy RBAC System: `docs/architecture/overview.md`
- Existing Waitlist Function: `supabase/functions/add-to-waitlist/index.ts`

## Changelog

### 2025-10-28 - Initial Implementation
- Created database migrations for invitation tracking
- Implemented `send-beta-invitation` Edge Function
- Built admin dashboard waitlist management UI
- Enhanced user creation trigger for auto-conversion
- Created bilingual beta invitation email template
- Added email preview feature with `EmailPreviewDialog` component
- Updated admin navigation with Waitlist section

---

**Implementation Status:** ✅ Complete (pending testing and deployment)

**Author:** Claude Code with @orchestrator agent
**Date:** October 28, 2025
**Version:** 1.0.0
