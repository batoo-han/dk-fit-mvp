import "server-only";

export function hasSameOrigin(origin: string | null, publicSiteUrl: URL): boolean {
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === publicSiteUrl.origin;
  } catch {
    return false;
  }
}

type LeadOriginPolicy = {
  publicSiteUrl: URL;
  runtimeMode: "development" | "test" | "production";
};

export function hasAllowedLeadOrigin(
  origin: string | null,
  requestUrl: string,
  policy: LeadOriginPolicy,
): boolean {
  if (hasSameOrigin(origin, policy.publicSiteUrl)) {
    return true;
  }

  if (policy.runtimeMode !== "development" || !origin) {
    return false;
  }

  try {
    const localOrigin = new URL(origin);
    const localRequestUrl = new URL(requestUrl);
    return (
      isSupportedLocalHost(localOrigin.hostname) &&
      isSupportedLocalHost(localRequestUrl.hostname) &&
      localOrigin.origin === localRequestUrl.origin
    );
  } catch {
    return false;
  }
}

function isSupportedLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
