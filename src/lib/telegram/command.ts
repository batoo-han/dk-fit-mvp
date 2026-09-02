const START_PAYLOAD = "registered";

export function parseStartCommand(text: string, username: string): boolean {
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(
    `^/start(?:@${escapedUsername})?(?: ${START_PAYLOAD})?$`,
    "u",
  );

  return pattern.test(text);
}
