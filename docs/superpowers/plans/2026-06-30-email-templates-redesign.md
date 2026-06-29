# Email Templates Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all email templates in Veylo to make them responsive, compatible with light/dark modes, and styled with a sleek high-end monochromatic (Vercel/Linear style) aesthetic.

**Architecture:** Use raw TypeScript template strings containing semantic HTML/CSS with inline styles as a base, combined with media queries (`prefers-color-scheme: dark`) and Outlook-specific selectors (`[data-ogsc]`) embedded in the `<head>` style tag for dark mode and responsive support.

**Tech Stack:** TypeScript, Vitest (for testing).

## Global Constraints

- Keep inline layout structure clean and simple for ultimate email client support.
- All files must reside under `src/templates/emails/`.
- Ensure typescript types and public interfaces of the email rendering engine remain unchanged.

---

### Task 1: Create Email Redesign Unit Tests

**Files:**
- Create: `tests/unit/email-templates.test.ts`

**Interfaces:**
- Consumes: `renderEmail` from `src/templates/emails/index.ts`

- [ ] **Step 1: Write the unit test**

Create the test file `tests/unit/email-templates.test.ts` to execute verification on all templates:
```typescript
import { describe, it, expect } from "vitest";
import { renderEmail } from "@/templates/emails";

describe("Email Templates Redesign", () => {
  const appName = "Veylo";

  it("should render welcome email", () => {
    const result = renderEmail("welcome", { firstName: "John" });
    expect(result.subject).toContain("Welcome to Veylo");
    expect(result.html).toContain("Hi John");
    expect(result.html).toContain("<!doctype html>");
  });

  it("should render forgot password email", () => {
    const result = renderEmail("forgot-password", { firstName: "John", resetUrl: "https://veylo.com/reset" });
    expect(result.subject).toContain("Reset your Veylo password");
    expect(result.html).toContain("https://veylo.com/reset");
  });

  it("should render verify email email", () => {
    const result = renderEmail("verify-email", { firstName: "John", verifyUrl: "https://veylo.com/verify" });
    expect(result.subject).toContain("Verify your email");
    expect(result.html).toContain("https://veylo.com/verify");
  });

  it("should render reset password success email", () => {
    const result = renderEmail("reset-password-success", { firstName: "John" });
    expect(result.subject).toContain("password was changed");
    expect(result.html).toContain("Security Notice");
  });

  it("should render two-factor otp email", () => {
    const result = renderEmail("two-factor-otp", { firstName: "John", otp: "123456" });
    expect(result.subject).toContain("Verify your identity");
    expect(result.html).toContain("123456");
  });

  it("should render invite email", () => {
    const result = renderEmail("invite", { inviteUrl: "https://veylo.com/invite", organizationName: "Acme", role: "admin" });
    expect(result.subject).toContain("invited to join Acme");
    expect(result.html).toContain("https://veylo.com/invite");
    expect(result.html).toContain("admin");
  });

  it("should render notification email", () => {
    const result = renderEmail("notification", { title: "New Task Assigned", message: "Go do the work." });
    expect(result.subject).toContain("New Task Assigned");
    expect(result.html).toContain("Go do the work.");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/email-templates.test.ts`
Expected: FAIL (either files fail compile due to missing import in `invite` or content assertions fail)

- [ ] **Step 3: Commit initial test**
```bash
git add tests/unit/email-templates.test.ts
git commit -m "test: add email template rendering verification tests"
```

---

### Task 2: Redesign Base Layout Wrapper (`_layout.ts`)

**Files:**
- Modify: `src/templates/emails/_layout.ts`

**Interfaces:**
- Consumes: None
- Produces: `emailLayout(input: LayoutInput): string`

- [ ] **Step 1: Write the redesigned layout code**

Replace `src/templates/emails/_layout.ts` with:
```typescript
type LayoutInput = {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerHtml?: string;
};

export function emailLayout(input: LayoutInput): string {
  const preheader = input.preheader
    ? `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;visibility:hidden;">${escapeHtml(input.preheader)}</span>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <style>
      :root {
        color-scheme: light dark;
        supported-color-schemes: light dark;
      }
      @media (prefers-color-scheme: dark) {
        body, .email-body {
          background-color: #000000 !important;
          color: #a3a3a3 !important;
        }
        .email-container {
          background-color: #0a0a0a !important;
          border-color: #1a1a1a !important;
        }
        .email-title {
          color: #f5f5f5 !important;
        }
        .email-text {
          color: #a3a3a3 !important;
        }
        .email-footer {
          color: #525252 !important;
          border-top-color: #1a1a1a !important;
        }
        .email-button {
          background-color: #f5f5f5 !important;
          color: #0a0a0a !important;
        }
        .email-code-box {
          background-color: #0f0f0f !important;
          border-color: #1a1a1a !important;
          color: #f5f5f5 !important;
        }
        .email-link {
          color: #f5f5f5 !important;
        }
        .email-badge {
          background-color: #1a1a1a !important;
          color: #f5f5f5 !important;
        }
        .email-meta-label {
          color: #737373 !important;
        }
        .email-meta-val {
          color: #f5f5f5 !important;
        }
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
      [data-ogsc] .email-meta-label { color: #737373 !important; }
      [data-ogsc] .email-meta-val { color: #f5f5f5 !important; }

      @media screen and (max-width: 600px) {
        .email-container {
          width: 100% !important;
          border-radius: 0 !important;
          border-left: none !important;
          border-right: none !important;
        }
        .email-padding {
          padding: 24px 16px !important;
        }
      }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
    ${preheader}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fafafa;padding:40px 0;" class="email-body">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:100%;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;" class="email-container">
            <tr>
              <td class="email-padding" style="padding:40px 40px 10px 40px;">
                <h1 class="email-title" style="margin:0;font-size:20px;font-weight:600;line-height:1.25;color:#171717;letter-spacing:-0.02em;">
                  ${escapeHtml(input.title)}
                </h1>
              </td>
            </tr>
            <tr>
              <td class="email-padding" style="padding:16px 40px 40px 40px;color:#404040;font-size:14px;line-height:1.6;" class="email-text">
                ${input.bodyHtml}
              </td>
            </tr>
            ${
              input.footerHtml
                ? `<tr>
                    <td class="email-padding" style="padding:16px 40px;color:#737373;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e5;" class="email-footer">
                      ${input.footerHtml}
                    </td>
                  </tr>`
                : ""
            }
          </table>
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:100%;">
            <tr>
              <td style="color:#737373;font-size:12px;line-height:1.5;padding:16px 24px;text-align:center;" class="email-footer">
                If you didn’t request this, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 2: Commit**
```bash
git add src/templates/emails/_layout.ts
git commit -m "style: implement modern high-end monochromatic email layout wrapper"
```

---

### Task 3: Redesign Authentication Flow Templates

**Files:**
- Modify: `src/templates/emails/forgot-password.ts`
- Modify: `src/templates/emails/verify-email.ts`
- Modify: `src/templates/emails/two-factor-otp.ts`
- Modify: `src/templates/emails/reset-password-success.ts`

**Interfaces:**
- Consumes: `emailLayout` from `src/templates/emails/_layout.ts`

- [ ] **Step 1: Update forgot-password.ts**
```typescript
import { emailLayout } from "./_layout";

export type ForgotPasswordEmailData = {
  firstName?: string;
  resetUrl: string;
};

export function forgotPasswordEmail(
  data: ForgotPasswordEmailData & { appName: string }
) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `Reset your ${data.appName} password`;

  const html = emailLayout({
    title: subject,
    preheader: "Use the link to reset your password.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        We received a request to reset your password. Click the button below to secure a new password for your account:
      </p>
      <p style="margin:0 0 24px 0;text-align:center;">
        <a href="${escapeHtml(data.resetUrl)}" class="email-button"
           style="display:inline-block;background-color:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;">
           Reset Password
        </a>
      </p>
      <p style="margin:0 0 8px 0;color:#737373;font-size:12px;" class="email-footer">
        Or copy and paste this link into your browser:
      </p>
      <div class="email-code-box" style="margin:0;background-color:#f5f5f5;border:1px solid #e5e5e5;padding:12px;border-radius:6px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.4;">
        <a href="${escapeHtml(data.resetUrl)}" class="email-link" style="color:#171717;text-decoration:none;">${escapeHtml(data.resetUrl)}</a>
      </div>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nReset your password: ${data.resetUrl}`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 2: Update verify-email.ts**
```typescript
import { emailLayout } from "./_layout";

export type VerifyEmailData = {
  firstName?: string;
  verifyUrl: string;
};

export function verifyEmailEmail(data: VerifyEmailData & { appName: string }) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `Verify your email for ${data.appName}`;

  const html = emailLayout({
    title: subject,
    preheader: "Confirm your email to finish setup.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        Please verify your email address to finish setting up your account and gain full access:
      </p>
      <p style="margin:0 0 24px 0;text-align:center;">
        <a href="${escapeHtml(data.verifyUrl)}" class="email-button"
           style="display:inline-block;background-color:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;">
           Verify Email
        </a>
      </p>
      <p style="margin:0 0 8px 0;color:#737373;font-size:12px;" class="email-footer">
        Or copy and paste this link into your browser:
      </p>
      <div class="email-code-box" style="margin:0;background-color:#f5f5f5;border:1px solid #e5e5e5;padding:12px;border-radius:6px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.4;">
        <a href="${escapeHtml(data.verifyUrl)}" class="email-link" style="color:#171717;text-decoration:none;">${escapeHtml(data.verifyUrl)}</a>
      </div>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nVerify your email: ${data.verifyUrl}`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 3: Update two-factor-otp.ts**
```typescript
import { emailLayout } from "./_layout";

export type TwoFactorOtpData = {
  firstName?: string;
  otp: string;
};

export function twoFactorOtpEmail(data: TwoFactorOtpData & { appName: string }) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `[${data.appName}] Verify your identity`;

  const html = emailLayout({
    title: subject,
    preheader: "Your verification code for two-factor authentication.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        Please use the verification code below to complete two-factor authentication setup or verification:
      </p>
      <div class="email-code-box" style="margin:24px 0;text-align:center;background-color:#f5f5f5;border:1px solid #e5e5e5;padding:24px;border-radius:8px;">
        <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#171717;">${escapeHtml(data.otp)}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#737373;line-height:1.5;" class="email-footer">
        This code is valid for 10 minutes. If you did not request this code, please secure your account credentials.
      </p>
    `,
  });

  const text = `${greeting}\n\nYour verification code is: ${data.otp}\n\nThis code will expire in 10 minutes.`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 4: Update reset-password-success.ts**
```typescript
import { emailLayout } from "./_layout";

export type ResetPasswordSuccessEmailData = {
  firstName?: string;
};

export function resetPasswordSuccessEmail(
  data: ResetPasswordSuccessEmailData & { appName: string }
) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `Your ${data.appName} password was changed`;

  const html = emailLayout({
    title: subject,
    preheader: "Password reset successful.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        This is a confirmation that your password for <strong>${escapeHtml(data.appName)}</strong> was changed successfully.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;background-color:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;" class="email-code-box">
        <tr>
          <td style="padding:16px;font-size:12px;color:#737373;line-height:1.5;" class="email-footer">
            <strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately or reset your password to secure your account.
          </td>
        </tr>
      </table>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nYour password was changed successfully.`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 5: Commit**
```bash
git add src/templates/emails/forgot-password.ts src/templates/emails/verify-email.ts src/templates/emails/two-factor-otp.ts src/templates/emails/reset-password-success.ts
git commit -m "style: redesign authentication flow email templates"
```

---

### Task 4: Redesign Workspace and Notification Templates

**Files:**
- Modify: `src/templates/emails/welcome.ts`
- Modify: `src/templates/emails/invite.ts`
- Modify: `src/templates/emails/notification.ts`

**Interfaces:**
- Consumes: `emailLayout` from `src/templates/emails/_layout.ts`

- [ ] **Step 1: Update welcome.ts**
```typescript
import { emailLayout } from "./_layout";

export type WelcomeEmailData = {
  firstName?: string;
};

export function welcomeEmail(data: WelcomeEmailData & { appName: string }) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `Welcome to ${data.appName}`;

  const html = emailLayout({
    title: subject,
    preheader: "Your account has been created.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        Thanks for signing up for <strong>${escapeHtml(data.appName)}</strong>. We’re excited to have you on board.
      </p>
      <p style="margin:0 0 12px 0;font-weight:500;">Here are a few next steps to get started:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px dashed #e5e5e5;color:#404040;" class="email-footer">
            <span style="font-weight:500;color:#171717;" class="email-title">1. Setup Profile</span> &mdash; Complete your personal information
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px dashed #e5e5e5;color:#404040;" class="email-footer">
            <span style="font-weight:500;color:#171717;" class="email-title">2. Invite Team</span> &mdash; Add your collaborators to your workspace
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#404040;">
            <span style="font-weight:500;color:#171717;" class="email-title">3. Explore Dashboard</span> &mdash; Check out features and start building
          </td>
        </tr>
      </table>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nThanks for signing up for ${data.appName}. We're excited to have you on board.`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 2: Update invite.ts**
```typescript
import { emailLayout } from "./_layout";

export type InviteEmailData = {
  inviteUrl: string;
  organizationName: string;
  role: string;
};

export const inviteEmail = (data: InviteEmailData) => {
  const subject = `You have been invited to join ${data.organizationName}`;

  const html = emailLayout({
    title: subject,
    preheader: `Join ${data.organizationName} as a ${data.role}.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">Hello,</p>
      <p style="margin:0 0 24px 0;">
        You have been invited to join the <strong>${escapeHtml(data.organizationName)}</strong> organization on Veylo.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;border:1px solid #e5e5e5;border-radius:8px;" class="email-code-box">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-size:13px;color:#737373;" class="email-footer email-meta-label" width="120">Organization</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-size:13px;font-weight:500;color:#171717;" class="email-title email-meta-val">${escapeHtml(data.organizationName)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#737373;" class="email-footer email-meta-label">Role</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:500;color:#171717;" class="email-title email-meta-val">${escapeHtml(data.role)}</td>
        </tr>
      </table>
      <p style="margin:0 0 24px 0;text-align:center;">
        <a href="${escapeHtml(data.inviteUrl)}" class="email-button"
           style="display:inline-block;background-color:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;">
           Accept Invitation
        </a>
      </p>
      <p style="margin:0 0 8px 0;color:#737373;font-size:12px;" class="email-footer">
        Or copy and paste this link into your browser:
      </p>
      <div class="email-code-box" style="margin:0;background-color:#f5f5f5;border:1px solid #e5e5e5;padding:12px;border-radius:6px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.4;">
        <a href="${escapeHtml(data.inviteUrl)}" class="email-link" style="color:#171717;text-decoration:none;">${escapeHtml(data.inviteUrl)}</a>
      </div>
    `,
  });

  return {
    subject,
    html,
  };
};

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 3: Update notification.ts**
```typescript
import { emailLayout } from "./_layout";

export type NotificationEmailData = {
  title: string;
  message: string;
};

export function notificationEmail(data: NotificationEmailData & { appName: string }) {
  const subject = `[${data.appName}] ${data.title}`;
  const html = emailLayout({
    title: data.title,
    preheader: data.message.slice(0, 100),
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#171717;" class="email-title">
        ${escapeHtml(data.title)}
      </p>
      <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#404040;" class="email-text">
        ${escapeHtml(data.message)}
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;border-top:1px solid #e5e5e5;padding-top:16px;" class="email-footer">
        <tr>
          <td style="font-size:12px;color:#737373;line-height:1.5;">
            You received this because you enabled email notifications for your Veylo account.
          </td>
        </tr>
      </table>
    `,
  });

  return { subject, html, text: data.message };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 4: Commit**
```bash
git add src/templates/emails/welcome.ts src/templates/emails/invite.ts src/templates/emails/notification.ts
git commit -m "style: redesign welcome, organization invite, and notification templates"
```

---

### Task 5: Final Typechecking, Formatting, Linting, and Verification

**Files:**
- Modify: None

**Interfaces:**
- Consumes: All updated templates
- Produces: None

- [ ] **Step 1: Run verification tests**

Run: `npx vitest run tests/unit/email-templates.test.ts`
Expected: PASS

- [ ] **Step 2: Run full backend test suite**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 3: Run typescript check**

Run: `npm run typecheck`
Expected: PASS with zero compile errors

- [ ] **Step 4: Format and lint code**

Run: `npm run format && npm run lint`
Expected: Success with clean formatting and no lint errors
