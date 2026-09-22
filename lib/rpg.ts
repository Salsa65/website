import { z } from "zod";
export const sections = [
  "Brainstorming",
  "Outlines",
  "Characters",
  "Worldbuilding",
  "Locations",
  "Lore",
  "Power Systems",
  "Plot Development",
  "Themes",
  "Research",
  "Rough Draft",
  "Final Draft",
];
export const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/u).length : 0;
export const dayKey = (time = Date.now()) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const safeNumber = z.number().finite().nonnegative();
const entrySchema = z.object({
  id: z.string(),
  title: z.string(),
  section: z.string(),
  body: z.string(),
  creditedWords: safeNumber,
  updatedAt: safeNumber,
  projectId: z.string().optional(),
  archived: z.boolean().optional(),
});
const logSchema = z.object({
  id: z.string(),
  kind: z.enum(["write", "train", "quest"]),
  label: z.string(),
  xp: safeNumber,
  at: safeNumber,
  minutes: safeNumber.optional(),
  sets: safeNumber.optional(),
  reps: safeNumber.optional(),
  weight: safeNumber.optional(),
  distance: safeNumber.optional(),
  notes: z.string().optional(),
  newWords: safeNumber.optional(),
  rest: safeNumber.optional(),
});
export const defaultRules = {
  writing: 20,
  training: 100,
  shortTraining: 20,
  writingCap: 600,
  trainingCap: 300,
};
const rulesSchema = z.object({
  writing: safeNumber.max(200),
  training: safeNumber.max(1000),
  shortTraining: safeNumber.max(200),
  writingCap: safeNumber.max(5000),
  trainingCap: safeNumber.max(5000),
});
export const stateSchema = z.object({
  version: z.literal(2),
  xp: safeNumber,
  entries: z.array(entrySchema),
  logs: z.array(logSchema),
  questDay: z.string(),
  completed: z.array(z.string()),
  profile: z.string(),
  alignment: z.enum(["Balanced", "Light", "Darkness"]),
  mode: z.enum(["Hybrid", "Writing", "Training"]),
  customSections: z.array(z.string()),
  projects: z
    .array(z.object({ id: z.string(), title: z.string() }))
    .min(1)
    .default([{ id: "default", title: "My first story" }]),
  activeProject: z.string().default("default"),
  templates: z
    .array(z.object({ id: z.string(), title: z.string(), workout: logSchema }))
    .default([]),
  rules: rulesSchema.default(defaultRules),
  customQuests: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        xp: safeNumber.max(500),
        kind: z.enum(["Writing", "Training", "Hybrid"]),
        target: z.number().int().min(1).max(100000),
      }),
    )
    .default([]),
  title: z.string().default("Wanderer"),
  crest: z.enum(["Sword", "Moon", "Sun"]).default("Sword"),
});
export type RpgState = z.infer<typeof stateSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Activity = z.infer<typeof logSchema>;
export function initialState(): RpgState {
  return {
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
    projects: [{ id: "default", title: "My first story" }],
    activeProject: "default",
    templates: [],
    rules: { ...defaultRules },
    customQuests: [],
    title: "Wanderer",
    crest: "Sword",
  };
}
export function restoreState(raw: string): RpgState {
  const v = JSON.parse(raw);
  if (v?.version === 2) {
    const parsed = stateSchema.parse(v);
    if (!parsed.projects.some((p) => p.id === parsed.activeProject))
      parsed.activeProject = parsed.projects[0].id;
    if (
      new Set(parsed.entries.map((e) => e.id)).size !== parsed.entries.length ||
      new Set(parsed.projects.map((p) => p.id)).size !== parsed.projects.length
    )
      throw new Error("Duplicate ids");
    parsed.entries = parsed.entries.map((e) =>
      parsed.projects.some((p) => p.id === (e.projectId ?? "default"))
        ? e
        : { ...e, projectId: parsed.activeProject },
    );
    return parsed;
  }
  if (!v || typeof v !== "object" || !("draft" in v))
    throw new Error("Unrecognized backup");
  const state = initialState();
  state.xp =
    typeof v.xp === "number" && Number.isFinite(v.xp) ? Math.max(0, v.xp) : 0;
  if (typeof v.draft === "string" && v.draft)
    state.entries = [
      {
        id: "legacy-draft",
        title: "Recovered draft",
        section: "Rough Draft",
        body: v.draft,
        creditedWords: countWords(v.draft),
        updatedAt: Date.now(),
      },
    ];
  state.logs = z.array(logSchema).parse(v.logs ?? []);
  return state;
}
export function dailyState(state: RpgState, at = Date.now()): RpgState {
  return state.questDay === dayKey(at)
    ? state
    : { ...state, questDay: dayKey(at), completed: [] };
}
export function writingReward(
  state: RpgState,
  id: string,
  at = Date.now(),
): RpgState {
  const entry = state.entries.find((e) => e.id === id);
  if (!entry || entry.archived) return state;
  const words = countWords(entry.body),
    previous = Math.floor(entry.creditedWords / 100),
    current = Math.floor(words / 100);
  const earned = state.logs
    .filter((l) => l.kind === "write" && dayKey(l.at) === dayKey(at))
    .reduce((n, l) => n + l.xp, 0);
  const xp = Math.min(
    Math.max(0, current - previous) * state.rules.writing,
    Math.max(0, state.rules.writingCap - earned),
  );
  if (current <= previous) return state;
  return {
    ...state,
    xp: state.xp + xp,
    entries: state.entries.map((e) =>
      e.id === id
        ? { ...e, creditedWords: Math.max(e.creditedWords, words) }
        : e,
    ),
    logs: [
      {
        id: crypto.randomUUID(),
        kind: "write",
        label: `${entry.title || "Untitled"} · ${words} words`,
        xp,
        newWords: (current - previous) * 100,
        at,
      },
      ...state.logs,
    ],
  };
}
export function trainingReward(state: RpgState, log: Activity): RpgState {
  if (!log.minutes || log.minutes <= 0 || !Number.isFinite(log.minutes))
    return state;
  const earned = state.logs
    .filter((l) => l.kind === "train" && dayKey(l.at) === dayKey(log.at))
    .reduce((n, l) => n + l.xp, 0);
  const xp = Math.min(
    log.minutes && log.minutes >= 10
      ? state.rules.training
      : state.rules.shortTraining,
    Math.max(0, state.rules.trainingCap - earned),
  );
  return { ...state, xp: state.xp + xp, logs: [{ ...log, xp }, ...state.logs] };
}
export function questList(state: RpgState) {
  const today = state.logs.filter((l) => dayKey(l.at) === dayKey());
  const write =
    today
      .filter((l) => l.kind === "write")
      .reduce((s, l) => s + (l.newWords ?? l.xp * 5), 0) >= 300;
  const train = today.some((l) => l.kind === "train" && (l.minutes ?? 0) >= 10);
  return [
    {
      id: "words",
      label: "Write 300 new words",
      xp: 60,
      ready: write,
      kind: "Writing",
    },
    {
      id: "workout",
      label: "Log 10+ minutes of training",
      xp: 100,
      ready: train,
      kind: "Training",
    },
    {
      id: "hybrid",
      label: "Complete both daily paths",
      xp: 50,
      ready: write && train,
      kind: "Hybrid",
    },
    ...state.customQuests.map((q) => ({
      ...q,
      ready:
        q.kind === "Writing"
          ? today
              .filter((l) => l.kind === "write")
              .reduce((n, l) => n + (l.newWords ?? l.xp * 5), 0) >= q.target
          : q.kind === "Training"
            ? today
                .filter((l) => l.kind === "train")
                .reduce((n, l) => n + (l.minutes ?? 0), 0) >= q.target
            : write && train,
    })),
  ].filter((q) => state.mode === "Hybrid" || q.kind === state.mode);
}
export function claimQuest(state: RpgState, id: string): RpgState {
  const next = dailyState(state),
    quest = questList(next).find((q) => q.id === id);
  if (!quest?.ready || next.completed.includes(id)) return next;
  return {
    ...next,
    xp: next.xp + quest.xp,
    completed: [...next.completed, id],
    logs: [
      {
        id: crypto.randomUUID(),
        kind: "quest",
        label: quest.label,
        xp: quest.xp,
        at: Date.now(),
      },
      ...next.logs,
    ],
  };
}

export function streak(state: RpgState, at = Date.now()): number {
  const days = new Set(
    state.logs.filter((l) => l.kind !== "quest").map((l) => dayKey(l.at)),
  );
  const d = new Date(at);
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  let total = 0;
  while (days.has(dayKey(d.getTime()))) {
    total++;
    d.setDate(d.getDate() - 1);
  }
  return total;
}
export function editWorkout(
  state: RpgState,
  id: string,
  patch: Partial<Activity>,
): RpgState {
  const old = state.logs.find((l) => l.id === id && l.kind === "train");
  if (!old) return state;
  // Corrections preserve previously awarded XP; editing never mints another reward.
  return {
    ...state,
    logs: state.logs.map((l) =>
      l.id === id
        ? { ...l, ...patch, id: l.id, kind: l.kind, at: l.at, xp: l.xp }
        : l,
    ),
  };
}
export function moveEntry(
  state: RpgState,
  id: string,
  section: string,
): RpgState {
  if (![...sections, ...state.customSections].includes(section)) return state;
  return {
    ...state,
    entries: state.entries.map((e) =>
      e.id === id ? { ...e, section, updatedAt: Date.now() } : e,
    ),
  };
}
export function milestones(state: RpgState) {
  const words = state.entries.reduce((n, e) => n + countWords(e.body), 0),
    train = state.logs.filter((l) => l.kind === "train");
  return [
    { name: "First page", earned: words >= 100 },
    { name: "Worldbuilder", earned: words >= 1000 },
    { name: "Novelist", earned: words >= 10000 },
    { name: "First workout", earned: train.length >= 1 },
    { name: "Iron resolve", earned: train.length >= 10 },
    { name: "Seven-day flame", earned: streak(state) >= 7 },
    { name: "Ascendant", earned: state.xp >= 4000 },
  ];
}
