// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import RpgForge from "../components/RpgForge";
import { initialState } from "../lib/rpg";
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Redbound interactive flows", () => {
  it("loads saved content without overwriting it with initial state", async () => {
    const saved = {
      ...initialState(),
      xp: 780,
      profile: "Returning hero",
      entries: [
        {
          id: "saved",
          title: "Existing chapter",
          section: "Rough Draft",
          body: "Do not lose this draft.",
          creditedWords: 0,
          updatedAt: 1,
        },
      ],
    };
    localStorage.setItem("redbound-rpg-v1", JSON.stringify(saved));
    render(<RpgForge />);
    await screen.findByText(/Welcome, Returning hero/);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("redbound-rpg-v1")!).xp).toBe(780),
    );
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    expect(screen.getByLabelText("Your writing")).toHaveProperty(
      "value",
      "Do not lose this draft.",
    );
  });
  it("creates a project and puts a section entry in the correct project and category", async () => {
    render(<RpgForge />);
    await screen.findByText("Saved on this device");
    fireEvent.click(
      screen.getByRole("button", { name: "Library" }),
    );
    fireEvent.change(screen.getByLabelText("New project name"), {
      target: { value: "The second world" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    const section = screen.getByRole("heading", {
      name: "Worldbuilding",
    }).parentElement!;
    fireEvent.click(section.querySelector("button")!);
    fireEvent.change(screen.getByLabelText("Title", { exact: true }), {
      target: { value: "The sky city" },
    });
    fireEvent.change(screen.getByLabelText("Your writing"), {
      target: { value: "A city drifting over silver mountains." },
    });
    await waitFor(() => {
      const s = JSON.parse(localStorage.getItem("redbound-rpg-v1")!);
      expect(s.entries[0].section).toBe("Worldbuilding");
      expect(s.entries[0].projectId).toBe(s.activeProject);
      expect(
        s.projects.find((p: { id: string }) => p.id === s.activeProject).title,
      ).toBe("The second world");
    });
  });
  it("records and edits a workout without awarding the XP twice", async () => {
    render(<RpgForge />);
    await screen.findByText("Saved on this device");
    fireEvent.click(screen.getByRole("button", { name: "Train" }));
    fireEvent.click(screen.getByRole("button", { name: "Record workout" }));
    await screen.findByText("Workout recorded.");
    fireEvent.click(screen.getByRole("button", { name: "Edit workout" }));
    fireEvent.change(screen.getByLabelText("Duration (minutes)"), {
      target: { value: "30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save workout correction" }),
    );
    await waitFor(() => {
      const s = JSON.parse(localStorage.getItem("redbound-rpg-v1")!);
      expect(s.xp).toBe(100);
      expect(s.logs).toHaveLength(1);
      expect(s.logs[0].minutes).toBe(30);
    });
  });
  it("preserves unreadable data and displays recovery rather than erasing it", async () => {
    localStorage.setItem("redbound-rpg-v1", "broken-original");
    render(<RpgForge />);
    await screen.findByText("Your saved adventure needs attention");
    expect(localStorage.getItem("redbound-rpg-v1")).toBe("broken-original");
  });
  it("reports storage failure rather than claiming save succeeded", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    render(<RpgForge />);
    await screen.findByText("Save failed — export a backup now.");
  });
});
