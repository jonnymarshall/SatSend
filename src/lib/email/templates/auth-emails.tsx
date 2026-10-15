import { render } from "@react-email/render";
import { EmailButton, EmailHeading, EmailLayout, EmailLink, EmailText } from "./layout";

/**
 * Sign-up and sign-in emails (v1.5.11, roadmap v1.5.1.3-H). Supabase sends
 * these, not our code, so they are built ahead of time into static HTML
 * (scripts/email/build-auth-templates.tsx → supabase/templates/) with
 * Supabase's Go-template placeholder left in for it to fill. Built from the
 * same frame as the invoice emails so the two can't drift apart.
 */
const CONFIRMATION_URL = "{{ .ConfirmationURL }}";
const SITE_URL = "https://satsend.me";

export interface AuthTemplate {
  /** Supabase's template name (config.toml `[auth.email.template.<name>]`). */
  name: "confirmation" | "magic_link";
  file: string;
  subject: string;
  heading: string;
  body: string;
  button: string;
}

export const AUTH_TEMPLATES: readonly AuthTemplate[] = [
  {
    name: "confirmation",
    file: "confirmation.html",
    subject: "Confirm your SatSend account",
    heading: "Confirm your email",
    body: "Confirm this address to finish creating your SatSend account. You'll be signed in straight away.",
    button: "Confirm your email",
  },
  {
    name: "magic_link",
    file: "magic_link.html",
    subject: "Your SatSend sign-in link",
    heading: "Sign in to SatSend",
    body: "Use the button below to sign in. The link works once and expires soon.",
    button: "Sign in to SatSend",
  },
];

export function AuthEmail({ template }: { template: AuthTemplate }) {
  return (
    <EmailLayout preview={template.body} appUrl={SITE_URL}>
      <EmailHeading>{template.heading}</EmailHeading>
      <EmailText>{template.body}</EmailText>
      <EmailButton href={CONFIRMATION_URL}>{template.button}</EmailButton>
      <EmailText muted small>
        Or open this link: <EmailLink href={CONFIRMATION_URL}>{CONFIRMATION_URL}</EmailLink>
      </EmailText>
      <EmailText muted small>
        If you didn&apos;t ask for this, ignore this email.
      </EmailText>
    </EmailLayout>
  );
}

export function buildAuthTemplate(template: AuthTemplate): Promise<string> {
  return render(<AuthEmail template={template} />, { pretty: true });
}
