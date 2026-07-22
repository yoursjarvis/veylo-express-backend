import { vi, describe, it, expect, beforeEach } from "vitest";
import { ResendDriver } from "@/core/mail/drivers/resend.driver";
import { SmtpDriver } from "@/core/mail/drivers/smtp.driver";

// Mock config, Resend, and Nodemailer with hoisting
const {
  configMock,
  resendEmailsSendMock,
  sendMailMock,
  createTransportMock,
  MockResend,
} = vi.hoisted(() => {
  const emailsSend = vi.fn();
  const sendMail = vi.fn();
  class ResendClass {
    emails = {
      send: emailsSend,
    };
  }
  return {
    configMock: vi.fn(),
    resendEmailsSendMock: emailsSend,
    sendMailMock: sendMail,
    createTransportMock: vi.fn().mockReturnValue({
      sendMail: sendMail,
    }),
    MockResend: ResendClass,
  };
});

vi.mock("@/utils/config", () => ({
  config: configMock,
}));

vi.mock("resend", () => ({
  Resend: MockResend,
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

describe("ResendDriver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail to send if api key is missing", async () => {
    configMock.mockReturnValue(undefined);
    const driver = new ResendDriver();
    const result = await driver.send({
      from: { address: "test@example.com" },
      to: [{ address: "dest@example.com" }],
      subject: "Test",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("RESEND_API_KEY is missing");
  });

  it("should send email successfully with key", async () => {
    configMock.mockReturnValue("apiKey123");
    resendEmailsSendMock.mockResolvedValueOnce({ data: { id: "resend-id" } });

    const driver = new ResendDriver();
    const result = await driver.send({
      from: { name: "Sender", address: "test@example.com" },
      to: [{ name: "Receiver", address: "dest@example.com" }],
      subject: "Hello",
      html: "<p>HTML</p>",
      text: "TEXT",
      replyTo: { name: "Support", address: "support@example.com" },
      attachments: [
        {
          filename: "test.txt",
          content: "hello world",
          contentType: "text/plain",
        },
        {
          filename: "binary.bin",
          content: Buffer.from("bin"),
          contentType: "application/octet-stream",
        },
      ],
    });

    expect(resendEmailsSendMock).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe("resend-id");
  });

  it("should handle error when resend send fails", async () => {
    configMock.mockReturnValue("apiKey123");
    resendEmailsSendMock.mockRejectedValueOnce(new Error("Resend Error"));

    const driver = new ResendDriver();
    const result = await driver.send({
      from: { address: "test@example.com" },
      to: [{ address: "dest@example.com" }],
      subject: "Test",
    });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("Resend Error");
  });
});

describe("SmtpDriver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send email via smtp transport", async () => {
    configMock.mockImplementation((key: string) => {
      if (key === "mail.mailers.smtp.encryption") return "ssl";
      if (key === "mail.mailers.smtp.host") return "smtp.mailtrap.io";
      if (key === "mail.mailers.smtp.port") return 465;
      if (key === "mail.mailers.smtp.username") return "user";
      if (key === "mail.mailers.smtp.password") return "pass";
      return undefined;
    });
    sendMailMock.mockResolvedValueOnce({ messageId: "smtp-message-id" });

    const driver = new SmtpDriver();
    const result = await driver.send({
      from: { name: "Sender", address: "sender@example.com" },
      to: [{ name: "Receiver", address: "receiver@example.com" }],
      replyTo: { name: "Support", address: "support@example.com" },
      subject: "SMTP Hello",
      html: "<p>HTML</p>",
      text: "TEXT",
      attachments: [
        { filename: "doc.txt", content: "data", contentType: "text/plain" },
      ],
    });

    expect(sendMailMock).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe("smtp-message-id");
  });

  it("should send without names in from/to addresses and none encryption", async () => {
    configMock.mockImplementation((key: string) => {
      if (key === "mail.mailers.smtp.encryption") return "none";
      return undefined;
    });
    sendMailMock.mockResolvedValueOnce({ messageId: "smtp-message-id" });

    const driver = new SmtpDriver();
    const result = await driver.send({
      from: { address: "sender@example.com" },
      to: [{ address: "receiver@example.com" }],
      subject: "SMTP Hello",
    });

    expect(result.ok).toBe(true);
  });

  it("should handle error when smtp transport fails", async () => {
    configMock.mockReturnValue(undefined);
    sendMailMock.mockRejectedValueOnce(new Error("SMTP Failure"));

    const driver = new SmtpDriver();
    const result = await driver.send({
      from: { address: "sender@example.com" },
      to: [{ address: "receiver@example.com" }],
      subject: "SMTP Fail",
    });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("SMTP Failure");
  });
});
