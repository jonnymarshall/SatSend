import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

describe("DropdownMenuItem", () => {
  it("shows a hand cursor on items you can click (v1.5.41)", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await user.click(screen.getByText("Open"));
    const item = await screen.findByRole("menuitem", { name: "Duplicate" });
    expect(item.className).toContain("cursor-pointer");
    expect(item.className).not.toContain("cursor-default");
  });
});
