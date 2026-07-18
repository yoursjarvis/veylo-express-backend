import { vi, describe, it, expect, beforeEach } from "vitest";

const {
  configMock,
  mailQueueAddMock,
  driverSendMock,
  renderEmailMock,
} = vi.hoisted(() => ({
  configMock: vi.fn(),
  mailQueueAddMock: vi.fn(),
  driverSendMock: vi.fn().mockResolvedValue({ ok: true }),
  renderEmailMock: vi.fn(),
}));

vi.mock("@/utils/config", () => ({
  config: configMock,
}));

vi.mock("@/app/queues/mail.queue", () => ({
  mailQueue: {
    add: mailQueueAddMock,
  },
}));

vi.mock("@/templates/emails", () => ({
  renderEmail: renderEmailMock,
}));

// Mock SmtpDriver and ResendDriver at their source files
vi.mock("@/core/mail/drivers/smtp.driver", () => {
  return {
    SmtpDriver: class {
      send = driverSendMock;
    },
  };
});

vi.mock("@/core/mail/drivers/resend.driver", () => {
  return {
    ResendDriver: class {
      send = driverSendMock;
    },
  };
});

import { mailService, sendMailMessage } from "../../src/core/mail/mail.service";

describe("MailService / MailBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendMailMessage", () => {
    it("should choose resend driver if default is resend", async () => {
      configMock.mockImplementation((key) => {
        if (key === "mail.default") return "resend";
        return undefined;
      });
      driverSendMock.mockResolvedValueOnce({ ok: true });

      const msg = { to: [{ address: "a@a.com" }], from: { address: "b@b.com" }, subject: "hi" };
      const res = await sendMailMessage(msg);
      expect(res.ok).toBe(true);
      expect(driverSendMock).toHaveBeenCalledWith(msg);
    });

    it("should choose smtp driver if default is smtp", async () => {
      configMock.mockImplementation((key) => {
        if (key === "mail.default") return "smtp";
        return undefined;
      });
      driverSendMock.mockResolvedValueOnce({ ok: false, error: new Error("SMTP Down") });

      const msg = { to: [{ address: "a@a.com" }], from: { address: "b@b.com" }, subject: "hi" };
      const res = await sendMailMessage(msg);
      expect(res.ok).toBe(false);
    });
  });

  describe("MailBuilder", () => {
    it("should throw error if buildMessage is called without recipient", async () => {
      const builder = mailService.to(""); // empty normalized address
      await expect(builder.send()).resolves.toEqual({
        ok: false,
        error: expect.any(Error),
      });
    });

    it("should throw error if buildMessage is called without template", async () => {
      const builder = mailService.to("a@a.com");
      await expect(builder.send()).resolves.toEqual({
        ok: false,
        error: expect.any(Error),
      });
    });

    it("should successfully build, send direct message", async () => {
      configMock.mockImplementation((key) => {
        if (key === "mail.from.address") return "from@from.com";
        if (key === "mail.from.name") return "From Name";
        return undefined;
      });
      renderEmailMock.mockReturnValueOnce({
        subject: "Rendered Subject",
        html: "<p>HTML</p>",
        text: "TEXT",
        headers: { "X-Custom": "header" },
      });
      driverSendMock.mockResolvedValueOnce({ ok: true, messageId: "msg-123" });

      const res = await mailService
        .to("recipient@dest.com", "Recipient")
        .from("override@sender.com", "Override")
        .subject("Subject Override")
        .view("notification", { title: "T", message: "M" })
        .attach({ filename: "test.txt", content: "data" })
        .send();

      expect(res.ok).toBe(true);
      expect(driverSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Subject Override",
          attachments: [{ filename: "test.txt", content: "data" }],
        })
      );
    });

    it("should queue message successfully", async () => {
      renderEmailMock.mockReturnValueOnce({
        subject: "Rendered Subject",
        html: "<p>HTML</p>",
        text: "TEXT",
      });
      configMock.mockImplementation((key) => {
        if (key === "mail.queue.attempts") return 5;
        return undefined;
      });
      mailQueueAddMock.mockResolvedValueOnce({ id: "job-123" });

      const res = await mailService
        .to("recipient@dest.com")
        .view("notification", { title: "T", message: "M" })
        .queue();

      expect(res).toEqual({ ok: true, jobId: "job-123" });
      expect(mailQueueAddMock).toHaveBeenCalledWith(
        "send",
        expect.any(Object),
        expect.objectContaining({ attempts: 5 })
      );
    });

    it("should fallback to direct send if queue enqueuing fails and fallback is enabled", async () => {
      renderEmailMock.mockReturnValueOnce({
        subject: "Rendered Subject",
        html: "<p>HTML</p>",
        text: "TEXT",
      });
      configMock.mockImplementation((key) => {
        if (key === "mail.queue.fallbackToSend") return true;
        if (key === "mail.default") return "resend";
        return undefined;
      });
      mailQueueAddMock.mockRejectedValueOnce(new Error("Queue full"));
      driverSendMock.mockResolvedValueOnce({ ok: true });

      const builder = mailService
        .to("recipient@dest.com")
        .view("notification", { title: "T", message: "M" });
      
      const sendSpy = vi.spyOn(builder, "send").mockResolvedValueOnce({ ok: true });

      const res = await builder.queue();

      expect(res).toEqual({ ok: true, jobId: "fallback:send" });
      expect(sendSpy).toHaveBeenCalled();
    });

    it("should return ok:false if queue enqueuing fails and fallback is disabled", async () => {
      renderEmailMock.mockReturnValueOnce({
        subject: "Rendered Subject",
        html: "<p>HTML</p>",
        text: "TEXT",
      });
      configMock.mockImplementation((key) => {
        if (key === "mail.queue.fallbackToSend") return false;
        return undefined;
      });
      mailQueueAddMock.mockRejectedValueOnce(new Error("Queue full"));

      const res = await mailService
        .to("recipient@dest.com")
        .view("notification", { title: "T", message: "M" })
        .queue();

      expect(res.ok).toBe(false);
      expect(driverSendMock).not.toHaveBeenCalled();
    });

    it("should return ok:false on queue validation failure before adding to queue", async () => {
      const res = await mailService.to("recipient@dest.com").queue();
      expect(res.ok).toBe(false);
      expect(mailQueueAddMock).not.toHaveBeenCalled();
    });
  });
});
