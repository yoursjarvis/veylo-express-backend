import { describe, expect, it } from "vitest";

import { parseUserAgent } from "../../src/utils/user-agent";

describe("user-agent parsing utility", () => {
  it("UT-UA-01: returns empty object if user-agent is undefined or empty", () => {
    expect(parseUserAgent(undefined)).toEqual({});
    expect(parseUserAgent("")).toEqual({});
  });

  it("UT-UA-02: parses Windows OS and Chrome browser correctly", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      os: "Windows",
      browser: "Chrome",
    });
  });

  it("UT-UA-03: parses macOS and Safari browser correctly", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
    expect(parseUserAgent(ua)).toEqual({
      os: "macOS",
      browser: "Safari",
    });
  });

  it("UT-UA-04: parses Android OS and Firefox browser correctly", () => {
    const ua = "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0";
    expect(parseUserAgent(ua)).toEqual({
      os: "Android",
      browser: "Firefox",
    });
  });

  it("UT-UA-05: parses iOS and Chrome browser correctly (WIP/Edge cases)", () => {
    const iPhoneUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(iPhoneUa)).toEqual({
      os: "iOS",
      browser: "Safari",
    });
  });

  it("UT-UA-06: parses Edge browser correctly", () => {
    const edgeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";
    expect(parseUserAgent(edgeUa)).toEqual({
      os: "Windows",
      browser: "Edge",
    });
  });

  it("UT-UA-07: returns undefined browser/os for unrecognized strings", () => {
    const unknownUa = "curl/8.4.0";
    expect(parseUserAgent(unknownUa)).toEqual({
      os: undefined,
      browser: undefined,
    });
  });
});
