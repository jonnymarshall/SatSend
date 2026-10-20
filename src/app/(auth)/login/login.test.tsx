import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "./page";
import SignupPage from "../signup/page";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }) } })),
}));

// Form behaviour is tested in src/components/auth/auth-form.test.tsx; these
// check the pages pass the address-bar values through (v1.5.14).
describe("auth pages", () => {
  it("/login?email=…&error=auth fills the email and explains the expired link", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ email: "ada@example.com", error: "auth" }) }));
    expect(screen.getByRole("heading", { name: "Log in to SatSend" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("ada@example.com");
    expect(screen.getByRole("status")).toHaveTextContent(/expired or was already used/i);
  });

  it("/login on its own shows an empty form and no expired-link note", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("/signup?email=… is the Create account form with the email filled in", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ email: "ada@example.com" }) }));
    expect(screen.getByRole("heading", { name: "Create your SatSend account" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("ada@example.com");
  });
});
