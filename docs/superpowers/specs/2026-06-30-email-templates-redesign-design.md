# Design Spec: Email Templates Redesign for Veylo

This document outlines the design and implementation details for redesigning all transactional email templates under the Veylo express backend repository (`src/templates/emails`).

## 1. Goals & Principles

- **High-End Monochromatic Aesthetic**: Minimalist, clean, utilizing pitch black and pure white/slate accents (similar to Vercel/Linear).
- **Email Client Compatibility**: Robust table-based baseline with modern styling that degrades gracefully in legacy email clients (like Outlook desktop).
- **Dark/Light Mode Compatibility**: Dynamic color-theme switching using `prefers-color-scheme` and specific Outlook dark mode tags `[data-ogsc]/[data-ogsb]`.
- **Responsive Layout**: Flexible tables scaling down to mobile viewports.
- **Unified Layout Pattern**: Ensure all templates (including `invite.ts`) use the unified layout wrapper.

---

## 2. Base Design Details (`_layout.ts`)

### Color Mapping

| Element | Light Mode (Default Inline) | Dark Mode (CSS Overrides) |
| :--- | :--- | :--- |
| **Body Background** | `#fafafa` (light grey) | `#000000` (pure black) |
| **Card Container** | `#ffffff` (white) | `#0a0a0a` (off-black) |
| **Card Border** | `1px solid #e5e5e5` (neutral-200) | `1px solid #1a1a1a` (neutral-800) |
| **Primary Text** | `#171717` (neutral-900) | `#f5f5f5` (neutral-100) |
| **Secondary Text** | `#404040` (neutral-700) | `#a3a3a3` (neutral-400) |
| **Muted/Footer Text** | `#737373` (neutral-500) | `#525252` (neutral-600) |
| **Primary Button** | BG: `#171717`, Text: `#ffffff` | BG: `#f5f5f5`, Text: `#0a0a0a` |
| **Highlight Box (OTP)**| BG: `#f5f5f5`, Border: `#e5e5e5`| BG: `#0f0f0f`, Border: `#1a1a1a` |

### Responsive & Dark Mode Stylesheet (in `<head>`)

```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  :root {
    color-scheme: light dark;
    supported-color-schemes: light dark;
  }
  @media (prefers-color-scheme: dark) {
    body, .email-body { background-color: #000000 !important; color: #a3a3a3 !important; }
    .email-container { background-color: #0a0a0a !important; border-color: #1a1a1a !important; }
    .email-title { color: #f5f5f5 !important; }
    .email-text { color: #a3a3a3 !important; }
    .email-footer { color: #525252 !important; border-top-color: #1a1a1a !important; }
    .email-button { background-color: #f5f5f5 !important; color: #0a0a0a !important; }
    .email-code-box { background-color: #0f0f0f !important; border-color: #1a1a1a !important; color: #f5f5f5 !important; }
    .email-link { color: #f5f5f5 !important; }
    .email-badge { background-color: #1a1a1a !important; color: #f5f5f5 !important; }
  }
  /* Outlook dark mode overrides */
  [data-ogsc] body, [data-ogsc] .email-body { background-color: #000000 !important; color: #a3a3a3 !important; }
  [data-ogsc] .email-container { background-color: #0a0a0a !important; border-color: #1a1a1a !important; }
  [data-ogsc] .email-title { color: #f5f5f5 !important; }
  [data-ogsc] .email-text { color: #a3a3a3 !important; }
  [data-ogsc] .email-footer { color: #525252 !important; border-top-color: #1a1a1a !important; }
  [data-ogsc] .email-button { background-color: #f5f5f5 !important; color: #0a0a0a !important; }
  [data-ogsc] .email-code-box { background-color: #0f0f0f !important; border-color: #1a1a1a !important; color: #f5f5f5 !important; }
  [data-ogsc] .email-link { color: #f5f5f5 !important; }
  [data-ogsc] .email-badge { background-color: #1a1a1a !important; color: #f5f5f5 !important; }

  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-padding { padding: 24px 16px !important; }
  }
</style>
```

---

## 3. Individual Templates Design

### 3.1 Welcome Email (`welcome.ts`)
- **Headline**: Welcome to [appName]
- **Structure**: Modern greeting card.
- **Content**: 
  - Personalized greeting.
  - Minimal list of onboarding next steps.
  - Monochromatic call-to-action button linking to the app's dashboard.

### 3.2 Forgot Password (`forgot-password.ts`)
- **Headline**: Reset your [appName] password
- **Structure**: Action card with verification link.
- **Content**:
  - Direct message: "We received a request to reset your password..."
  - High-contrast action button.
  - Fallback raw link in a subtle monospace container.

### 3.3 Verify Email (`verify-email.ts`)
- **Headline**: Verify your email for [appName]
- **Structure**: Action card with confirmation link.
- **Content**:
  - Direct message: "Please verify your email address to finish setting up your account."
  - High-contrast action button.
  - Fallback raw link.

### 3.4 Reset Password Success (`reset-password-success.ts`)
- **Headline**: Your [appName] password was changed
- **Structure**: Transactional notification security alert.
- **Content**:
  - Confirmation description.
  - Security warning box: "If you didn't request this, please contact support immediately."

### 3.5 Two-Factor OTP (`two-factor-otp.ts`)
- **Headline**: Verify your identity
- **Structure**: Centered, high-contrast OTP container.
- **Content**:
  - OTP display code in a large monospace card component (e.g. `32px` font size, bold, letter-spacing).
  - Expiry notice text.

### 3.6 Invite Email (`invite.ts`)
- **Headline**: You have been invited to join [organizationName]
- **Structure**: Unified layout integration.
- **Content**:
  - Details table showing **Organization** and **Role** inside a sleek clean table.
  - CTA button "Accept Invitation".

### 3.7 Notification Email (`notification.ts`)
- **Headline**: [appName] notification
- **Structure**: Clean message layout.
- **Content**:
  - Clean title.
  - Message body text.
  - Direct settings link at the bottom.

---

## 4. Implementation Steps

1. Update `src/templates/emails/_layout.ts` to implement the new styling structure, dark/light mode styles, and responsive stylesheet.
2. Refactor each template file:
   - `forgot-password.ts`
   - `invite.ts` (bring into the unified layout ecosystem)
   - `notification.ts`
   - `reset-password-success.ts`
   - `two-factor-otp.ts`
   - `verify-email.ts`
   - `welcome.ts`
3. Ensure types (`EmailTemplateMap`, data interfaces) are preserved and robust.
4. Run standard TypeScript compile/lint checks to verify there are no compilation errors.
