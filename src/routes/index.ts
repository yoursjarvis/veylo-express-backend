import { Request, Response, Router } from "express";

import { apiV1Routes } from "@/routes/v1";
import { renderEmail, type EmailTemplateName } from "@/templates/emails";
import { config } from "@/utils/config";

export const routes = Router();

const testData: Record<EmailTemplateName, Record<string, unknown>> = {
  welcome: {
    firstName: "John",
  },
  "forgot-password": {
    firstName: "John",
    resetUrl: "https://veylo.com/reset-password?token=test-token",
  },
  "verify-email": {
    firstName: "John",
    verifyUrl: "https://veylo.com/verify-email?token=test-token",
  },
  "reset-password-success": {
    firstName: "John",
  },
  "two-factor-otp": {
    firstName: "John",
    otp: "123456",
  },
  invite: {
    inviteUrl: "https://veylo.com/invite?token=test-token",
    organizationName: "Acme Corp",
    role: "Admin",
  },
  notification: {
    title: "New Project Assigned",
    message:
      "You have been assigned to the project Veylo Redesign. Please review the tasks and start working on it.",
  },
};

const handleEmailPreview = (req: Request, res: Response) => {
  const appEnv = config("app.env") as string;
  if (appEnv !== "local" && appEnv !== "development") {
    return res
      .status(403)
      .send(
        "Forbidden: Email preview is only available in local or development environments.",
      );
  }

  const templateName = (req.query.template ||
    Object.keys(req.query)[0]) as EmailTemplateName;

  if (!templateName) {
    const templates = Object.keys(testData) as EmailTemplateName[];
    const htmlList = templates
      .map(
        (name) =>
          `<li><a href="/email?${name}" style="color:#171717;text-decoration:none;font-weight:500;">${name}</a></li>`,
      )
      .join("\n");

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Email Templates Preview</title>
    <style>
      body {
        background-color: #fafafa;
        color: #171717;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 40px;
        display: flex;
        justify-content: center;
      }
      .container {
        width: 500px;
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 12px;
        padding: 40px;
      }
      h1 {
        font-size: 20px;
        font-weight: 600;
        margin-top: 0;
        margin-bottom: 24px;
        border-bottom: 1px solid #e5e5e5;
        padding-bottom: 16px;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      li {
        padding: 12px 16px;
        border-bottom: 1px dashed #e5e5e5;
      }
      li:last-child {
        border-bottom: none;
      }
      li:hover {
        background: #fafafa;
        border-radius: 6px;
      }
      a {
        display: block;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background-color: #000000;
          color: #f5f5f5;
        }
        .container {
          background: #0a0a0a;
          border-color: #1a1a1a;
        }
        h1 {
          border-bottom-color: #1a1a1a;
        }
        li {
          border-bottom-color: #1a1a1a;
        }
        li:hover {
          background: #0f0f0f;
        }
        a {
          color: #f5f5f5 !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Email Templates Preview</h1>
      <ul>
        ${htmlList}
      </ul>
    </div>
  </body>
</html>`;
    return res.send(html);
  }

  if (!testData[templateName]) {
    return res
      .status(404)
      .send(
        `Template "${templateName}" not found. Available templates: ${Object.keys(testData).join(", ")}`,
      );
  }

  try {
    const rendered = renderEmail(templateName, testData[templateName] as never);
    res.setHeader("Content-Type", "text/html");
    return res.send(rendered.html);
  } catch (error) {
    return res
      .status(500)
      .send(`Error rendering template: ${(error as Error).message}`);
  }
};

routes.get("/email", handleEmailPreview);
routes.get("/eamil", handleEmailPreview);

routes.use("/api/v1", apiV1Routes);
