import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  AdminEmailDlqTab,
  EMAIL_DLQ_PAGE_SIZE,
  type EmailDlqListResponse,
} from "../AdminEmailDlqTab";

vi.mock("../../ui", () => ({
  DeepSightSpinner: () => <div data-testid="spinner" />,
}));

const page = (total: number): EmailDlqListResponse => ({
  items: [
    {
      id: 1,
      email_to: "contact@deepsightsynthesis.com",
      subject: "[DeepSight Contact] Question",
      failed_at: "2026-11-27T10:00:00",
      error_message: "RESEND_API_KEY not configured",
      replay_status: "pending",
      body_text: "De: Alice <alice@example.com>\n\n<b>pas du HTML</b>",
    },
  ],
  total,
  limit: EMAIL_DLQ_PAGE_SIZE,
  offset: 0,
});

describe("AdminEmailDlqTab", () => {
  afterEach(() => cleanup());

  it("liste les emails avec destinataire, sujet et corps en texte brut", async () => {
    const adminFetch = vi.fn().mockResolvedValue(page(1));
    render(<AdminEmailDlqTab adminFetch={adminFetch} language="fr" />);

    expect(
      await screen.findByText("[DeepSight Contact] Question"),
    ).toBeInTheDocument();
    expect(adminFetch).toHaveBeenCalledWith(
      `/api/admin/email-dlq?include_body=true&limit=${EMAIL_DLQ_PAGE_SIZE}&offset=0`,
    );
    expect(
      screen.getByText(/contact@deepsightsynthesis\.com/),
    ).toBeInTheDocument();
    // Corps affiché tel quel, jamais interprété comme du HTML
    expect(screen.getByText(/<b>pas du HTML<\/b>/)).toBeInTheDocument();
    // Lecture seule : aucun bouton de renvoi
    expect(screen.queryByText(/replay|renvoyer/i)).toBeNull();
  });

  it("pagine par offset", async () => {
    const adminFetch = vi.fn().mockResolvedValue(page(45));
    render(<AdminEmailDlqTab adminFetch={adminFetch} language="fr" />);

    fireEvent.click(await screen.findByLabelText("Page suivante"));

    await screen.findByText(/Page 2 \/ 3/);
    expect(adminFetch).toHaveBeenLastCalledWith(
      `/api/admin/email-dlq?include_body=true&limit=${EMAIL_DLQ_PAGE_SIZE}&offset=${EMAIL_DLQ_PAGE_SIZE}`,
    );
  });
});
