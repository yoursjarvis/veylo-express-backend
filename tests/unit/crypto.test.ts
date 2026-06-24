import { describe, expect, it, vi } from "vitest";

const { configMock } = vi.hoisted(() => ({
  configMock: vi.fn().mockImplementation((key: string) => {
    if (key === "app.vaultEncryptionKey") return "test-secret-key-must-be-long-enough-32-chars";
    return undefined;
  }),
}));

vi.mock("../../src/utils/config", () => ({
  config: configMock,
}));

import { encrypt, decrypt } from "../../src/utils/crypto";

describe("crypto helper utilities", () => {
  it("UT-CRY-01: encrypts and decrypts a plain text string successfully", () => {
    const text = "Hello, World!";
    const encrypted = encrypt(text);
    
    // Check format (iv:ciphertext:tag)
    expect(encrypted).toContain(":");
    expect(encrypted.split(":")).toHaveLength(3);
    
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it("UT-CRY-02: generates randomized encryption (different IVs for same text)", () => {
    const text = "SecretData";
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);
    
    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(text);
    expect(decrypt(enc2)).toBe(text);
  });

  it("UT-CRY-03: throws an error when decrypting an invalid format string", () => {
    expect(() => decrypt("invalidformat")).toThrowError("Invalid cipher text format");
    expect(() => decrypt("part1:part2")).toThrowError("Invalid cipher text format");
    expect(() => decrypt("part1:part2:part3:part4")).toThrowError("Invalid cipher text format");
  });

  it("UT-CRY-04: throws integrity check error for tampered ciphertext", () => {
    const text = "SuperSensitiveMessage";
    const encrypted = encrypt(text);
    const parts = encrypted.split(":");
    
    // Modify one character in ciphertext payload (part index 1)
    const originalCipher = parts[1];
    const tamperedCipher = originalCipher.substring(0, originalCipher.length - 1) + (originalCipher.endsWith("0") ? "1" : "0");
    const tamperedEncrypted = `${parts[0]}:${tamperedCipher}:${parts[2]}`;
    
    expect(() => decrypt(tamperedEncrypted)).toThrow();
  });
});
