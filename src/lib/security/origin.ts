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
