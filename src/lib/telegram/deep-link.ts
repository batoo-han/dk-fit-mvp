const REGISTRATION_PAYLOAD = "registered";

export function buildTelegramDeepLink(username: string): string {
  return `https://t.me/${username}?start=${REGISTRATION_PAYLOAD}`;
}
