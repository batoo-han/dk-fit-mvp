import type { LeadSubmitRequest } from "../../lib/contracts/lead";

const REQUEST_TIMEOUT_MS = 15_000;

type SubmitLeadOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type LeadSubmitClientRequest = Omit<LeadSubmitRequest, "website"> & {
  website?: string;
};

export async function submitLead(
  request: LeadSubmitClientRequest,
  idempotencyKey: string,
  { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS }: SubmitLeadOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new DOMException("Timed out", "AbortError")), timeoutMs);

  try {
    return await fetchImpl("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(request),
      signal: controller.signal,
      credentials: "same-origin",
    });
  } finally {
    window.clearTimeout(timeout);
  }
}
