import { readFile } from "node:fs/promises";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadForm } from "../../src/features/lead-form/LeadForm";
import { submitLead, type LeadSubmitClientRequest } from "../../src/features/lead-form/submit-lead";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm() {
  return render(<LeadForm />);
}

function fillValidLead() {
  fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Анна Иванова" } });
  fireEvent.change(screen.getByLabelText("Телефон"), { target: { value: "+7 900 000-00-00" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Согласие на обработку данных/u }));
}

describe("LeadForm", () => {
  it("renders visible labels, autocomplete, consent and a privacy link", () => {
    renderForm();

    expect(screen.getByLabelText("Имя").getAttribute("autocomplete")).toBe("name");
    expect(screen.getByLabelText("Телефон").getAttribute("autocomplete")).toBe("tel");
    expect(screen.getByLabelText("Телефон").getAttribute("inputmode")).toBe("tel");
    expect(screen.getByRole("link", { name: "Политика обработки данных" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("status")).not.toBeNull();
  });

  it("keeps 44px touch targets and visible keyboard focus for consent controls", async () => {
    const css = await readFile("src/features/lead-form/LeadForm.module.css", "utf8");

    expect(css).toMatch(/\.consent input\s*\{[^}]*block-size:\s*2\.75rem;/su);
    expect(css).toMatch(/\.consent input\s*\{[^}]*inline-size:\s*2\.75rem;/su);
    expect(css).toMatch(/\.privacy\s*\{[^}]*min-block-size:\s*2\.75rem;/su);
    expect(css).toMatch(/\.privacy:focus-visible\s*\{/u);
  });

  it("marks the first invalid field and focuses it after submit", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    const name = screen.getByLabelText("Имя");
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Заполните это поле")).not.toBeNull();
  });

  it("uses one idempotency key while a request is pending and disables duplicate submits", async () => {
    const request = vi.fn<(payload: LeadSubmitClientRequest, idempotencyKey: string) => Promise<Response>>(() => new Promise<Response>(() => undefined));
    render(<LeadForm request={request} />);
    fillValidLead();

    const submit = screen.getByRole("button", { name: "Отправить заявку" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(request.mock.calls[0]?.[1]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("redirects only after a 201 email acceptance response", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "email_accepted", telegramDeepLink: "https://t.me/test_bot?start=registered" }), { status: 201 }),
    );
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    render(<LeadForm request={request} />);
    fillValidLead();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText("Заявка отправлена. Открываем Telegram…")).not.toBeNull();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://t.me/test_bot?start=registered"));
  });

  it("starts timing when the form mounts so a valid interaction passes the server two-second rule", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const request = vi.fn(async (payload: LeadSubmitClientRequest) => new Response(
      JSON.stringify(
        Date.now() - payload.startedAt >= 2_000
          ? { ok: true, status: "email_accepted", telegramDeepLink: "https://t.me/test_bot?start=registered" }
          : { ok: false, error: { code: "INVALID_REQUEST", requestId: "request-id" } },
      ),
      { status: Date.now() - payload.startedAt >= 2_000 ? 201 : 422 },
    ));
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    render(<LeadForm request={request} />);
    fillValidLead();

    now.mockReturnValue(3_001);
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText("Заявка отправлена. Открываем Telegram…")).not.toBeNull();
    expect(request.mock.calls[0]?.[0].startedAt).toBe(1_000);
  });

  it("retains the form start time for an unchanged network retry", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: "EMAIL_UNAVAILABLE", requestId: "request-id" } }), { status: 503 }));
    render(<LeadForm request={request} />);
    fillValidLead();

    now.mockReturnValue(3_001);
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    expect(await screen.findByText("Не удалось отправить заявку. Проверьте подключение и повторите попытку.")).not.toBeNull();
    now.mockReturnValue(6_001);
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[0]?.[0].startedAt).toBe(1_000);
    expect(request.mock.calls[1]?.[0].startedAt).toBe(1_000);
  });

  it("submits the actual honeypot value", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: "INVALID_REQUEST", requestId: "request-id" } }), { status: 422 }),
    );
    render(<LeadForm request={request} />);
    fillValidLead();
    const honeypot = document.getElementById("lead-website");
    expect(honeypot).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(honeypot!, { target: { value: "bot.example" } });

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ website: "bot.example" }));
  });

  it("announces a generic 422 when the server has no field error", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: "INVALID_REQUEST", requestId: "request-id" } }), { status: 422 }),
    );
    render(<LeadForm request={request} />);
    fillValidLead();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Проверьте введённые данные и повторите попытку."));
  });

  it.each([
    [422, { name: ["Укажите имя"] }, "Укажите имя"],
    [429, undefined, "Слишком много попыток. Попробуйте позже."],
    [503, undefined, "Сервис временно недоступен. Попробуйте ещё раз позже."],
  ])("retains values and stays on page for HTTP %i", async (status, fieldErrors, expectedMessage) => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: "INVALID_REQUEST", requestId: "request-id", fieldErrors } }), { status }),
    );
    render(<LeadForm request={request} />);
    fillValidLead();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText(expectedMessage)).not.toBeNull();
    expect((screen.getByLabelText("Имя") as HTMLInputElement).value).toBe("Анна Иванова");
    expect((screen.getByLabelText("Телефон") as HTMLInputElement).value).toBe("+7 900 000-00-00");
  });

  it("keeps the idempotency key for an offline retry without an automatic resubmit", async () => {
    const request = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: { code: "EMAIL_UNAVAILABLE", requestId: "request-id" } }), { status: 503 }),
    );
    render(<LeadForm request={request} />);
    fillValidLead();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    expect(await screen.findByText("Не удалось отправить заявку. Проверьте подключение и повторите попытку.")).not.toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1]?.[1]).toBe(request.mock.calls[0]?.[1]);
  });

  it("creates a new idempotency key after the lead is edited", async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: "EMAIL_UNAVAILABLE", requestId: "request-id" } }), { status: 503 }));
    render(<LeadForm request={request} />);
    fillValidLead();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    expect(await screen.findByText("Не удалось отправить заявку. Проверьте подключение и повторите попытку.")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Анна Петрова" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1]?.[1]).not.toBe(request.mock.calls[0]?.[1]);
  });

  it("does not submit again when remounted after browser Back", () => {
    const request = vi.fn();
    const { unmount } = render(<LeadForm request={request} />);
    unmount();
    render(<LeadForm request={request} />);

    expect(request).not.toHaveBeenCalled();
  });
});

describe("submitLead", () => {
  it("aborts a stalled request after the configured timeout", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")));
      }),
    );

    await expect(
      submitLead(
        { name: "Анна", phone: "+7 900 000-00-00", consent: true, website: "", startedAt: 1_700_000_000_000 },
        "b758e60e-42b4-4d85-8ee9-9a36c3e5f9e6",
        { fetchImpl, timeoutMs: 1 },
      ),
    ).rejects.toThrow("Timed out");

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/leads",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json", "Idempotency-Key": "b758e60e-42b4-4d85-8ee9-9a36c3e5f9e6" }),
      }),
    );
  });
});
