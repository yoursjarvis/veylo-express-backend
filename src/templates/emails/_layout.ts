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
        .email-warning-box {
          background-color: #0f0f0f !important;
          border-color: #1a1a1a !important;
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
      [data-ogsc] .email-warning-box { background-color: #0f0f0f !important; border-color: #1a1a1a !important; }

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
              <td class="email-padding email-text" style="padding:16px 40px 40px 40px;color:#404040;font-size:14px;line-height:1.6;">
                ${input.bodyHtml}
              </td>
            </tr>
            ${
              input.footerHtml
                ? `<tr>
                    <td class="email-padding email-footer" style="padding:16px 40px;color:#737373;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e5;">
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

export function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
