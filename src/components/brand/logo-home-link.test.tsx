import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoHomeLink } from "./logo-home-link";

describe("LogoHomeLink", () => {
  it("is a link to the homepage", () => {
    render(<LogoHomeLink id="test--logo" />);
    const link = screen.getByRole("link", { name: "SatSend, go to homepage" });
    expect(link.getAttribute("href")).toBe("/");
    expect(link.id).toBe("test--logo");
  });
});
