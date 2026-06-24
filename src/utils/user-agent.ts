export interface ParsedUserAgent {
  browser?: string;
  os?: string;
}

// Minimal UA parsing (no external dependency). Good enough for device history.
export function parseUserAgent(userAgent?: string): ParsedUserAgent {
  if (!userAgent) return {};

  const ua = userAgent.toLowerCase();

  const os =
    ua.includes("windows") ? "Windows" :
    ua.includes("iphone") || ua.includes("ipad") ? "iOS" :
    ua.includes("mac os x") ? "macOS" :
    ua.includes("android") ? "Android" :
    ua.includes("linux") ? "Linux" :
    undefined;

  const browser =
    ua.includes("edg/") ? "Edge" :
    ua.includes("chrome/") && !ua.includes("chromium") ? "Chrome" :
    ua.includes("safari/") && !ua.includes("chrome/") ? "Safari" :
    ua.includes("firefox/") ? "Firefox" :
    undefined;

  return { browser, os };
}

