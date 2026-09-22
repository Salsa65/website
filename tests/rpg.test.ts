import { describe, it, expect } from "vitest";
import {
  initialState,
  editWorkout,
  streak,
  moveEntry,
  questList,
  writingReward,
  trainingReward,
  restoreState,
  dailyState,
  claimQuest,
  dayKey,
} from "../lib/rpg";
const text = (n: number) => Array(n).fill("story").join(" ");
function withDraft(n = 300) {
  return {
    ...initialState(),
    entries: [
      {
        id: "draft",
        title: "Chapter",
        body: text(n),
        section: "Rough Draft",
        creditedWords: 0,
        updatedAt: Date.now(),
      },
    ],
  };
}
describe("RPG progression and recovery", () => {
  it("does not reward empty, repeated, deleted or regrown words", () => {
    let s = withDraft(0);
    expect(writingReward(s, "draft").xp).toBe(0);
    s = withDraft();
    s = writingReward(s, "draft");
    expect(s.xp).toBe(60);
    expect(writingReward(s, "draft").xp).toBe(60);
    s.entries[0].body = text(100);
    s = writingReward(s, "draft");
    s.entries[0].body = text(300);
    expect(writingReward(s, "draft").xp).toBe(60);
  });
  it("enforces the daily writing cap", () => {
    const s = writingReward(withDraft(4000), "draft");
    expect(s.xp).toBe(600);
    s.entries[0].body = text(4500);
    expect(writingReward(s, "draft").xp).toBe(600);
  });
  it("records workouts after the daily XP cap without adding XP", () => {
    let s = initialState();
    for (let i = 0; i < 5; i++)
      s = trainingReward(s, {
        id: String(i),
        kind: "train",
        label: "Cardio",
        minutes: 20,
        xp: 100,
        at: Date.now(),
      });
    expect(s.xp).toBe(300);
    expect(s.logs).toHaveLength(5);
  });
  it("requires activities and claims a daily quest once", () => {
    let s = withDraft();
    expect(claimQuest(s, "words").xp).toBe(0);
    s = writingReward(s, "draft");
    s = claimQuest(s, "words");
    expect(s.xp).toBe(120);
    expect(claimQuest(s, "words").xp).toBe(120);
    expect(dailyState({ ...s, questDay: "2000-01-01" }).completed).toEqual([]);
  });
  it("migrates old drafts without rewarding existing text again", () => {
    const s = restoreState(
      JSON.stringify({ draft: text(300), xp: 340, logs: [] }),
    );
    expect(s.entries[0].body).toBe(text(300));
    expect(writingReward(s, "legacy-draft").xp).toBe(340);
  });
  it("round trips backups and rejects invalid state", () => {
    const s = withDraft();
    expect(restoreState(JSON.stringify(s))).toEqual(s);
    expect(() => restoreState("{")).toThrow();
    expect(() => restoreState(JSON.stringify({ ...s, xp: -1 }))).toThrow();
    expect(dayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("Complete adventure data", () => {
  it("loads an earlier v2 backup with project and progression defaults", () => {
    const old = {
      version: 2,
      xp: 0,
      entries: [],
      logs: [],
      questDay: dayKey(),
      completed: [],
      profile: "Hero",
      alignment: "Balanced",
      mode: "Hybrid",
      customSections: [],
    };
    const restored = restoreState(JSON.stringify(old));
    expect(restored.activeProject).toBe("default");
    expect(restored.projects).toHaveLength(1);
    expect(restored.rules.writing).toBe(20);
  });
  it("does not award XP again when editing a workout", () => {
    let s = trainingReward(initialState(), {
      id: "workout",
      kind: "train",
      label: "Cardio",
      xp: 0,
      at: Date.now(),
      minutes: 20,
    });
    s = editWorkout(s, "workout", { minutes: 60, xp: 10000 });
    expect(s.xp).toBe(100);
    expect(s.logs[0].xp).toBe(100);
    expect(s.logs[0].minutes).toBe(60);
    expect(s.logs).toHaveLength(1);
  });
  it("requires actual words even when reward rules change", () => {
    const s = withDraft(100);
    s.rules.writing = 100;
    const saved = writingReward(s, "draft");
    expect(saved.xp).toBe(100);
    expect(questList(saved).find((q) => q.id === "words")?.ready).toBe(false);
  });
  it("counts writing toward quests even when XP is disabled", () => {
    const s = withDraft();
    s.rules.writing = 0;
    const saved = writingReward(s, "draft");
    expect(saved.logs[0].newWords).toBe(300);
    expect(questList(saved).find((q) => q.id === "words")?.ready).toBe(true);
    expect(writingReward(saved, "draft").logs).toHaveLength(1);
  });
  it("moves an entry without changing its content or credited words", () => {
    const s = writingReward(withDraft(), "draft");
    const next = moveEntry(s, "draft", "Final Draft");
    expect(next.entries[0].body).toBe(s.entries[0].body);
    expect(next.entries[0].creditedWords).toBe(300);
    expect(writingReward(next, "draft").xp).toBe(60);
    expect(moveEntry(s, "draft", "missing")).toBe(s);
  });
  it("counts consecutive local days across a month boundary", () => {
    const s = initialState();
    const now = new Date(2026, 8, 2, 12).getTime();
    s.logs = [1, 2, 3].map((_, i) => ({
      id: String(i),
      kind: "train",
      label: "Cardio",
      xp: 100,
      at: new Date(2026, 8, 2 - i, 12).getTime(),
    }));
    expect(streak(s, now)).toBe(3);
    expect(streak(s, new Date(2026, 8, 4, 12).getTime())).toBe(0);
  });
  it("does not grant rewards to archived entries", () => {
    const s = withDraft();
    const archived = {
      ...s,
      entries: s.entries.map((e) => ({ ...e, archived: true })),
    };
    expect(writingReward(archived, "draft").xp).toBe(0);
  });
});
