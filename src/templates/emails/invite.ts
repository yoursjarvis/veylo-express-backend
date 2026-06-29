import { config } from "@/utils/config";

import { emailLayout, escapeHtml } from "./_layout";

export type InviteEmailData = {
  inviteUrl: string;
  organizationName: string;
  role: string;
};

export const inviteEmail = (data: InviteEmailData) => {
  const appName = config("app.name") || "Veylo";
  const subject = `You have been invited to join ${data.organizationName}`;

  const html = emailLayout({
    title: subject,
    preheader: `Join ${data.organizationName} as a ${data.role}.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">Hello,</p>
      <p style="margin:0 0 24px 0;">
        You have been invited to join the <strong>${escapeHtml(data.organizationName)}</strong> organization on ${escapeHtml(appName)}.
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
