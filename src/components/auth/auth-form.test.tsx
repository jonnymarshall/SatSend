import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "./auth-form";

const mockSignInWithOtp = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp: (...a: unknown[]) => mockSignInWithOtp(...a) } }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  mockSignInWithOtp.mockResolvedValue({ error: null });
});

const otpError = (code: string, status: number) => ({ error: { code, status, message: code } });
const checkResponse = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

async function submit(email: string, button: RegExp) {
  const user = userEvent.setup();
  const field = screen.getByRole("textbox", { name: /email/i });
  await user.clear(field);
  await user.type(field, email);
  await user.click(screen.getByRole("button", { name: button }));
}

describe("AuthForm — log in (v1.5.14)", () => {
  it("is titled for logging in and links to creating an account, carrying the email", async () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("heading", { name: "Log in to SatSend" })).toBeInTheDocument();
    await userEvent.setup().type(screen.getByRole("textbox", { name: /email/i }), "ada@example.com");
    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute(
      "href",
      "/signup?email=ada%40example.com",
    );
  });

  it("never creates an account, and confirms a sign-in link is on its way", async () => {
    render(<AuthForm mode="login" />);
    await submit("ada@example.com", /send sign-in link/i);
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    );
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(/sent a sign-in link to/i)).toBeInTheDocument();
  });

  it("an email with no account gets a prompt to create one, not a 'check your email'", async () => {
    mockSignInWithOtp.mockResolvedValue(otpError("otp_disabled", 422));
    render(<AuthForm mode="login" />);
    await submit("new@example.com", /send sign-in link/i);
    expect(await screen.findByText("There's no SatSend account for that email.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup?email=new%40example.com",
    );
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  });

  it("shows why a link couldn't be sent instead of pretending it was", async () => {
    mockSignInWithOtp.mockResolvedValue(otpError("over_email_send_rate_limit", 429));
    render(<AuthForm mode="login" />);
    await submit("ada@example.com", /send sign-in link/i);
    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a minute/i);
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  });

  it("explains an expired or used link", () => {
    render(<AuthForm mode="login" linkExpired />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "That link has expired or was already used. Enter your email and we'll send a new one.",
    );
  });

  it("starts with the email carried over from the other page", () => {
    render(<AuthForm mode="login" initialEmail="ada@example.com" />);
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("ada@example.com");
  });
});

describe("AuthForm — create account (v1.5.14)", () => {
  it("is titled for creating an account and links to logging in", () => {
    render(<AuthForm mode="signup" initialEmail="ada@example.com" />);
    expect(screen.getByRole("heading", { name: "Create your SatSend account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?email=ada%40example.com");
  });

  it("checks the email on the server first, then sends a confirm-your-account link", async () => {
    mockFetch.mockReturnValue(checkResponse(200, { registered: false }));
    render(<AuthForm mode="signup" />);
    await submit("new@example.com", /create account/i);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/signup-check",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "new@example.com" }) }),
    );
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ shouldCreateUser: true }) }),
    );
    expect(await screen.findByText(/sent a link to confirm your account to/i)).toBeInTheDocument();
  });

  it("an email that already has an account sends nothing and offers to log in", async () => {
    mockFetch.mockReturnValue(checkResponse(200, { registered: true }));
    render(<AuthForm mode="signup" />);
    await submit("ada@example.com", /create account/i);
    expect(await screen.findByText("You already have an account with that email.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in instead" })).toHaveAttribute(
      "href",
      "/login?email=ada%40example.com",
    );
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it("too many attempts from one connection: explains, sends nothing", async () => {
    mockFetch.mockReturnValue(checkResponse(429, {}));
    render(<AuthForm mode="signup" />);
    await submit("new@example.com", /create account/i);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many sign-up attempts from your connection. Please try again in an hour.",
    );
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it("if the check itself fails, says so and sends nothing", async () => {
    mockFetch.mockReturnValue(checkResponse(503, { error: "x" }));
    render(<AuthForm mode="signup" />);
    await submit("new@example.com", /create account/i);
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });
});
