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
