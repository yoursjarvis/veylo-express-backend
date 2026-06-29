import { describe, it, expect } from "vitest";

import { renderEmail } from "@/templates/emails";

describe("Email Templates Redesign", () => {
  it("should render welcome email", () => {
    const result = renderEmail("welcome", { firstName: "John" });
    expect(result.subject).toMatch(/Welcome to Veylo( API)?/);
    expect(result.html).toContain("Hi John");
    expect(result.html).toContain("<!doctype html>");
  });

  it("should render forgot password email", () => {
    const result = renderEmail("forgot-password", {
      firstName: "John",
      resetUrl: "https://veylo.com/reset",
    });
    expect(result.subject).toMatch(/Reset your Veylo( API)? password/);
    expect(result.html).toContain("https://veylo.com/reset");
  });

  it("should render verify email email", () => {
    const result = renderEmail("verify-email", {
      firstName: "John",
      verifyUrl: "https://veylo.com/verify",
    });
    expect(result.subject).toMatch(/Verify your email/);
    expect(result.html).toContain("https://veylo.com/verify");
  });

  it("should render reset password success email", () => {
    const result = renderEmail("reset-password-success", { firstName: "John" });
    expect(result.subject).toMatch(
      /(password was changed|Password Reset Successful)/i,
    );
    expect(result.html).toContain("Security Notice");
    // Ensure the td cell uses email-text class rather than email-footer for contrast
    expect(result.html).toContain(
      'class="email-text">\n            <strong>Security Notice:</strong>',
    );
  });

  it("should render two-factor otp email", () => {
    const result = renderEmail("two-factor-otp", {
      firstName: "John & Jane",
      otp: "123456",
    });
    expect(result.subject).toContain("Verify your identity");
    expect(result.html).toContain("123456");
    // Ensure plain text greeting does not have HTML entities escaped
    expect(result.text).toContain("Hi John & Jane,");
    expect(result.text).not.toContain("&amp;");
    // Ensure HTML version still escapes HTML entities
    expect(result.html).toContain("Hi John &amp; Jane,");
  });

  it("should render invite email", () => {
    const result = renderEmail("invite", {
      inviteUrl: "https://veylo.com/invite",
      organizationName: "Acme",
      role: "admin",
    });
    expect(result.subject).toContain("invited to join Acme");
    expect(result.html).toContain("https://veylo.com/invite");
    expect(result.html).toContain("admin");
  });

  it("should render notification email", () => {
    const result = renderEmail("notification", {
      title: "New Task Assigned",
      message: "Go do the work.",
    });
    expect(result.subject).toContain("New Task Assigned");
    expect(result.html).toContain("Go do the work.");
  });
});
