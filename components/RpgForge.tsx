"use client";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Dumbbell,
  Flame,
  Home,
  Library,
  PenLine,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  claimQuest,
  editWorkout,
  moveEntry,
  streak,
  type Activity,
  countWords,
  dailyState,
  dayKey,
  initialState,
  questList,
  restoreState,
  sections,
  trainingReward,
  writingReward,
  type Entry,
  type RpgState,
} from "../lib/rpg";
import Image from "next/image";
import { ProjectBar, ProgressionTools } from "./RpgTools";
import styles from "./RpgForge.module.css";
const KEY = "redbound-rpg-v1";
export default function RpgForge() {
  const [state, setState] = useState<RpgState>(initialState),
    [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState("Loading saved adventure…");
  const [view, setView] = useState("Home"),
    [active, setActive] = useState(""),
    [query, setQuery] = useState(""),
    [message, setMessage] = useState(""),
    [customSection, setCustomSection] = useState("");
  const [exercise, setExercise] = useState("Strength training"),
    [minutes, setMinutes] = useState(20),
    [sets, setSets] = useState(3),
    [reps, setReps] = useState(10),
    [weight, setWeight] = useState(0),
    [distance, setDistance] = useState(0),
    [notes, setNotes] = useState(""),
    [rest, setRest] = useState(60),
    [editing, setEditing] = useState(""),
    [showArchive, setShowArchive] = useState(false),
    [historyLimit, setHistoryLimit] = useState(30);
  const [loadError, setLoadError] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const previousXp = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (
      previousXp.current !== null &&
      Math.floor(state.xp / 1000) > Math.floor(previousXp.current / 1000)
    )
      setMessage(
        `Level up! You reached level ${Math.floor(state.xp / 1000) + 1}.`,
      );
    previousXp.current = state.xp;
  }, [state.xp, ready]);
  useEffect(() => {
    if (
      "serviceWorker" in navigator &&
      !window.location.hostname.includes("localhost")
    )
      navigator.serviceWorker
        .register(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/redbound-sw.js`)
        .catch(() => {
          /* Local saves remain available if offline installation fails. */
        });
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = restoreState(raw);
        setState(dailyState(saved));
        setActive(saved.entries[0]?.id ?? "");
      }
      setReady(true);
    } catch {
      setLoadError(true);
      setSaveStatus(
        "Saved data could not be loaded. Export the saved file before restoring a backup.",
      );
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      setSaveStatus("Saved on this device");
    } catch {
      setSaveStatus("Save failed — export a backup now.");
    }
  }, [state, ready]);
  useEffect(() => {
    const timer = setInterval(() => setState((s) => dailyState(s)), 30000);
    return () => clearInterval(timer);
  }, []);
  const projectEntries = state.entries.filter(
    (e) =>
      (e.projectId ?? "default") === state.activeProject &&
      Boolean(e.archived) === showArchive,
  );
  const entry = projectEntries.find((e) => e.id === active),
    words = state.entries.reduce((n, e) => n + countWords(e.body), 0),
    level = Math.floor(state.xp / 1000) + 1,
    progress = state.xp % 1000;
  const training = state.logs.filter((l) => l.kind === "train"),
    writing = state.logs.filter((l) => l.kind === "write");
  const stats = {
    Strength: training.filter((l) => l.label === "Strength training").length,
    Endurance: training.filter(
      (l) => l.label === "Cardio" || l.label === "HIIT",
    ).length,
    Focus: writing.length,
    Creativity: Math.floor(words / 300),
    Discipline: new Set(state.logs.map((l) => dayKey(l.at))).size,
    Wisdom: Math.floor(words / 1000),
  };
  const allSections = [...sections, ...state.customSections];
  function go(next: string) {
    setView(next);
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function addEntry(section = "Brainstorming") {
    const e: Entry = {
      id: crypto.randomUUID(),
      title: "Untitled",
      section,
      projectId: state.activeProject,
      body: "",
      creditedWords: 0,
      updatedAt: Date.now(),
    };
    setState((s) => ({ ...s, entries: [e, ...s.entries] }));
    setActive(e.id);
    go("Write");
  }
  function updateEntry(patch: Partial<Entry>) {
    setState((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === active ? { ...e, ...patch, updatedAt: Date.now() } : e,
      ),
    }));
  }
  function logWorkout(e: React.FormEvent) {
    e.preventDefault();
    if (minutes <= 0 || !Number.isFinite(minutes)) return;
    setState((s) =>
      editing
        ? editWorkout(s, editing, {
            label: exercise,
            minutes,
            sets,
            reps,
            weight,
            distance,
            notes,
            rest,
          })
        : trainingReward(s, {
            id: editing || crypto.randomUUID(),
            kind: "train",
            label: exercise,
            xp: 0,
            at: Date.now(),
            minutes,
            sets,
            reps,
            weight,
            distance,
            notes,
            rest,
          }),
    );
    setMessage(
      editing
        ? "Workout corrected. Previously earned XP is unchanged."
        : "Workout recorded.",
    );
    setEditing("");
    setMinutes(0);
    setNotes("");
  }
  function loadWorkout(log: Activity, edit = false) {
    setExercise(log.label);
    setMinutes(log.minutes ?? 20);
    setSets(log.sets ?? 0);
    setReps(log.reps ?? 0);
    setWeight(log.weight ?? 0);
    setDistance(log.distance ?? 0);
    setNotes(log.notes ?? "");
    setRest(log.rest ?? 60);
    setEditing(edit ? log.id : "");
    go("Train");
  }
  function saveTemplate() {
    const title = window.prompt("Name this workout template");
    if (!title?.trim()) return;
    setState((s) => ({
      ...s,
      templates: [
        ...s.templates,
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          workout: {
            id: "template",
            kind: "train",
            label: exercise,
            xp: 0,
            at: 0,
            minutes,
            sets,
            reps,
            weight,
            distance,
            notes,
            rest,
          },
        },
      ],
    }));
  }
  function exportData() {
    const raw = loadError
      ? localStorage.getItem(KEY)
      : JSON.stringify(state, null, 2);
    const url = URL.createObjectURL(
      new Blob([raw ?? ""], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `redbound-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error("Too large");
      const imported = restoreState(await file.text());
      if (
        !window.confirm(
          "Replace this device’s adventure with this backup? Export your current adventure first if you want to keep it.",
        )
      )
        return;
      setState(dailyState(imported));
      setActive(imported.entries[0]?.id ?? "");
      setLoadError(false);
      setReady(true);
      setMessage("Backup restored.");
    } catch {
      setMessage(
        "Could not import: select a valid Redbound JSON backup under 10 MB.",
      );
    } finally {
      if (upload.current) upload.current.value = "";
    }
  }
  return (
    <main
      className={`${styles.shell} ${styles[state.alignment.toLowerCase()]}`}
    >
      <header>
        <div className={styles.crest} aria-hidden="true">
          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icons/redbound.svg`}
            width="56"
            height="56"
            alt=""
          />
        </div>
        <div>
          <small>WRITE · TRAIN · EVOLVE</small>
          <h1>REDBOUND</h1>
        </div>
        <div className={styles.level}>LV. {level}</div>
      </header>
      <p className={styles.status} role="status">
        {saveStatus}
      </p>
      <p className={styles.status} role="status">
        {message}
      </p>
      <input
        ref={upload}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(e) => void importData(e.target.files?.[0])}
      />
      {loadError ? (
        <section className={styles.panel}>
          <h2>Your saved adventure needs attention</h2>
          <button onClick={exportData}>Export saved file</button>
          <button onClick={() => upload.current?.click()}>
            Restore backup
          </button>
        </section>
      ) : !ready ? (
        <p>Opening your adventure…</p>
      ) : (
        <>
          {(view === "Write" || view === "Library") && (
            <ProjectBar
              state={state}
              setState={setState}
              onSelect={() => setActive("")}
            />
          )}
          {(view === "Home" || view === "Profile") && (
            <section className={styles.hero}>
              <div>
                <p>
                  Welcome, {state.profile || "Hero"} · {state.title} ·{" "}
                  {streak(state)} day streak
                </p>
                <h2>Discipline shapes the story you live.</h2>
              </div>
              <div className={styles.xp}>
                <b>
                  {progress} / 1,000 EXP · {state.xp} total
                </b>
                <i
                  role="progressbar"
                  aria-label="Experience to next level"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={1000}
                >
                  <span style={{ width: `${progress / 10}%` }} />
                </i>
              </div>
            </section>
          )}
          {view === "Home" && (
            <>
              <section className={styles.duality}>
                <div className={styles.darkWing} aria-hidden="true" />
                <div>
                  <span className={styles.heroCrest}>
                    {state.crest === "Sun"
                      ? "☼"
                      : state.crest === "Moon"
                        ? "☾"
                        : "⚔"}
                  </span>
                  <b>SAME SOUL</b>
                  <span>DIFFERENT PATHS</span>
                  <em>A STRONGER YOU</em>
                </div>
                <div className={styles.lightWing} aria-hidden="true" />
              </section>
              <div className={styles.grid}>
                <section className={styles.panel}>
                  <h3>
                    <Sparkles /> RPG STAT SHEET
                  </h3>
                  {Object.entries(stats).map(([k, v]) => (
                    <div className={styles.stat} key={k}>
                      <span>{k}</span>
                      <b>{v}</b>
                    </div>
                  ))}
                </section>
                <section className={styles.actions}>
                  <button onClick={() => go("Train")}>
                    <Dumbbell />
                    <b>TRAIN</b>
                    <span>Record your effort. Grow stronger.</span>
                  </button>
                  <button onClick={() => (entry ? go("Write") : addEntry())}>
                    <BookOpen />
                    <b>WRITE</b>
                    <span>Build worlds. Tell your story.</span>
                  </button>
                </section>
                <section className={styles.panel}>
                  <h3>
                    <Flame /> DAILY QUESTS
                  </h3>
                  {questList(state).map((q) => (
                    <button
                      disabled={
                        !q.ready || dailyState(state).completed.includes(q.id)
                      }
                      className={styles.quest}
                      key={q.id}
                      onClick={() => setState((s) => claimQuest(s, q.id))}
                    >
                      <span>
                        {dailyState(state).completed.includes(q.id) ? "✓" : ""}
                      </span>
                      <span className={styles.questLabel}>{q.label}</span>
                      <b>+{q.xp} XP</b>
                    </button>
                  ))}
                  <p className={styles.muted}>
                    Complete activities to unlock rewards. Quests reset daily.
                  </p>
                </section>
              </div>
            </>
          )}
          {view === "Train" && (
            <div className={styles.workspace}>
              <section className={styles.panel}>
                <h3>
                  <Dumbbell /> {editing ? "EDIT WORKOUT" : "LOG A WORKOUT"}
                </h3>
                <div className={styles.toolbar}>
                  <select
                    aria-label="Workout templates"
                    value=""
                    onChange={(e) => {
                      const t = state.templates.find(
                        (t) => t.id === e.target.value,
                      );
                      if (t) loadWorkout(t.workout);
                    }}
                  >
                    <option value="">Load a workout template</option>
                    {state.templates.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <button onClick={saveTemplate}>Save as template</button>
                </div>
                <form onSubmit={logWorkout} className={styles.form}>
                  <label>
                    Workout
                    <select
                      value={exercise}
                      onChange={(e) => setExercise(e.target.value)}
                    >
                      {[
                        "Strength training",
                        "Cardio",
                        "HIIT",
                        "Flexibility",
                        "Custom workout",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.fields}>
                    {[
                      ["Duration (minutes)", minutes, setMinutes, 1, 1440],
                      ["Sets", sets, setSets, 0, 100],
                      ["Reps per set", reps, setReps, 0, 1000],
                      ["Weight (kg)", weight, setWeight, 0, 1000],
                      ["Distance (km)", distance, setDistance, 0, 1000],
                      ["Rest between sets (seconds)", rest, setRest, 0, 3600],
                    ].map(([label, value, setter, min, max]) => (
                      <label key={String(label)}>
                        {String(label)}
                        <input
                          type="number"
                          required
                          min={Number(min)}
                          max={Number(max)}
                          step="any"
                          value={Number(value)}
                          onChange={(e) =>
                            (setter as (v: number) => void)(
                              Number(e.target.value),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    Workout notes
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Exercises, rest periods, how it felt…"
                    />
                  </label>
                  <button
                    className={styles.primary}
                    type="submit"
                    disabled={minutes <= 0}
                  >
                    {editing ? "Save workout correction" : "Record workout"}
                  </button>
                  <p className={styles.muted}>
                    10+ minutes: {state.rules.training} XP. Shorter sessions:{" "}
                    {state.rules.shortTraining} XP. Maximum{" "}
                    {state.rules.trainingCap} training XP per day.
                  </p>
                </form>
                {editing && (
                  <button
                    onClick={() => {
                      setEditing("");
                      setMinutes(20);
                    }}
                  >
                    Cancel correction
                  </button>
                )}
                <h4>Personal records</h4>
                <p>
                  Longest session:{" "}
                  {Math.max(0, ...training.map((l) => l.minutes ?? 0))} min ·
                  Heaviest load:{" "}
                  {Math.max(0, ...training.map((l) => l.weight ?? 0))} kg ·
                  Furthest distance:{" "}
                  {Math.max(0, ...training.map((l) => l.distance ?? 0))} km
                </p>
              </section>
            </div>
          )}
          {view === "Write" && (
            <section className={`${styles.panel} ${styles.workspace}`}>
              <h3>
                <PenLine /> WRITING STUDIO
              </h3>
              <div className={styles.toolbar}>
                <select
                  aria-label="Open writing entry"
                  value={active}
                  onChange={(e) => setActive(e.target.value)}
                >
                  <option value="">Choose an entry</option>
                  {projectEntries
                    .filter((e) => !e.archived)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title || "Untitled"}
                      </option>
                    ))}
                </select>
                <button onClick={() => addEntry()}>New entry</button>
              </div>
              {entry && !entry.archived ? (
                <div className={styles.form}>
                  <label>
                    Title
                    <input
                      value={entry.title}
                      onChange={(e) => updateEntry({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    Section
                    <select
                      value={entry.section}
                      onChange={(e) => updateEntry({ section: e.target.value })}
                    >
                      {allSections.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Move to project
                    <select
                      value={entry.projectId ?? "default"}
                      onChange={(e) => {
                        updateEntry({ projectId: e.target.value });
                        setActive("");
                      }}
                    >
                      {state.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Your writing
                    <textarea
                      className={styles.editor}
                      value={entry.body}
                      onChange={(e) => updateEntry({ body: e.target.value })}
                      placeholder="A world begins with a single sentence…"
                    />
                  </label>
                  <div className={styles.writerFoot}>
                    <span>{countWords(entry.body)} words</span>
                    <button
                      className={styles.primary}
                      onClick={() => {
                        setState((s) => writingReward(s, active));
                        setMessage(
                          "Session recorded. Only new 100-word milestones award XP.",
                        );
                      }}
                    >
                      Finish writing session
                    </button>
                  </div>
                  <p className={styles.muted}>
                    {state.rules.writing} XP per 100 new words, up to{" "}
                    {state.rules.writingCap} writing XP per day. Saving the same
                    words again earns no extra XP.
                  </p>
                  <button
                    onClick={() => {
                      updateEntry({ archived: true });
                      setActive("");
                      go("Library");
                    }}
                  >
                    Archive entry
                  </button>
                </div>
              ) : (
                <button className={styles.primary} onClick={() => addEntry()}>
                  Create your first entry
                </button>
              )}
            </section>
          )}
          {view === "Library" && (
            <section className={`${styles.panel} ${styles.workspace}`}>
              <h3>
                <Library /> YOUR LIBRARY
              </h3>
              <div className={styles.toolbar}>
                <input
                  aria-label="Search writing"
                  placeholder="Search titles, text, sections…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button onClick={() => addEntry()}>New entry</button>
              </div>
              <form
                className={styles.toolbar}
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = customSection.trim();
                  if (name && !allSections.includes(name)) {
                    setState((s) => ({
                      ...s,
                      customSections: [...s.customSections, name],
                    }));
                    setCustomSection("");
                  }
                }}
              >
                <input
                  aria-label="New section name"
                  placeholder="Create a custom section"
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  maxLength={80}
                />
                <button>Add section</button>
              </form>
              <button onClick={() => setShowArchive((v) => !v)}>
                {showArchive ? "Show active entries" : "Show archive"}
              </button>
              <p className={styles.muted}>
                Drag entries into sections, or use the entry editor’s Section
                menu on your phone.
              </p>
              {allSections.map((section) => {
                const entries = projectEntries.filter(
                  (e) =>
                    e.section === section &&
                    `${e.title} ${e.body} ${e.section}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                );
                return !query || entries.length ? (
                  <div
                    className={styles.sectionDrop}
                    key={section}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      setState((s) => moveEntry(s, id, section));
                    }}
                  >
                    <div className={styles.sectionHead}>
                      <h4>{section}</h4>
                      {!showArchive && (
                        <button onClick={() => addEntry(section)}>
                          Add entry
                        </button>
                      )}
                    </div>
                    {entries.map((e) => (
                      <button
                        key={e.id}
                        draggable={!showArchive}
                        onDragStart={(event) =>
                          event.dataTransfer.setData("text/plain", e.id)
                        }
                        className={styles.entry}
                        onClick={() => {
                          if (showArchive) {
                            setState((s) => ({
                              ...s,
                              entries: s.entries.map((x) =>
                                x.id === e.id ? { ...x, archived: false } : x,
                              ),
                            }));
                            setMessage("Entry restored.");
                            return;
                          }
                          setActive(e.id);
                          go("Write");
                        }}
                      >
                        <b>
                          {e.title || "Untitled"}
                          {showArchive ? " · Restore" : ""}
                        </b>
                        <span>
                          {e.body.slice(0, 120) || "Empty entry"} ·{" "}
                          {countWords(e.body)} words
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null;
              })}
              {!state.entries.length && (
                <p>Your notes and chapters will appear here.</p>
              )}
            </section>
          )}
          {view === "Profile" && (
            <section className={`${styles.panel} ${styles.workspace}`}>
              <h3>
                <UserRound /> HERO PROFILE
              </h3>
              <div className={styles.form}>
                <label>
                  Hero name
                  <input
                    value={state.profile}
                    maxLength={60}
                    onChange={(e) =>
                      setState((s) => ({ ...s, profile: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Your path
                  <select
                    value={state.mode}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        mode: e.target.value as RpgState["mode"],
                      }))
                    }
                  >
                    {["Hybrid", "Writing", "Training"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Alignment
                  <select
                    value={state.alignment}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        alignment: e.target.value as RpgState["alignment"],
                      }))
                    }
                  >
                    {["Balanced", "Light", "Darkness"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p>
                {words} words · {training.length} workouts ·{" "}
                {training.reduce((n, l) => n + (l.minutes ?? 0), 0)} training
                minutes
              </p>
              <h4>Achievements</h4>
              <p>
                {[
                  words >= 100 ? "First page" : null,
                  training.length ? "First workout" : null,
                  level >= 2 ? "Level 2 adventurer" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Your first achievement awaits."}
              </p>
              <div className={styles.toolbar}>
                <button onClick={exportData}>Export backup</button>
                <button onClick={() => upload.current?.click()}>
                  Import backup
                </button>
              </div>
              <p className={styles.muted}>
                Data stays on this browser or device. Export regularly to keep a
                separate backup or move your adventure.
              </p>
            </section>
          )}
          {view === "Profile" && (
            <ProgressionTools state={state} setState={setState} />
          )}
          {(view === "Home" || view === "Train") && (
            <section className={`${styles.panel} ${styles.workspace}`}>
              <h3>
                <Library />{" "}
                {view === "Train" ? "WORKOUT HISTORY" : "ADVENTURE LOG"}
              </h3>
              {(view === "Train" ? training : state.logs)
                .slice(0, historyLimit)
                .map((l) => (
                  <div className={styles.log} key={l.id}>
                    <div>
                      {l.label}
                      <small className={styles.details}>
                        {new Date(l.at).toLocaleString()}
                        {l.minutes
                          ? ` · ${l.minutes} min · ${l.sets ?? 0} × ${l.reps ?? 0} reps · ${l.weight ?? 0} kg · ${l.distance ?? 0} km`
                          : ""}
                      </small>
                      {l.notes && <p>{l.notes}</p>}
                      {view === "Train" && (
                        <div className={styles.toolbar}>
                          <button onClick={() => loadWorkout(l, true)}>
                            Edit workout
                          </button>
                          <button onClick={() => loadWorkout(l)}>
                            Repeat workout
                          </button>
                        </div>
                      )}
                    </div>
                    <b>+{l.xp}</b>
                  </div>
                ))}
              {historyLimit <
                (view === "Train" ? training : state.logs).length && (
                <button onClick={() => setHistoryLimit((n) => n + 30)}>
                  Show more history
                </button>
              )}
              {!state.logs.length && (
                <p className={styles.muted}>Your first quest awaits.</p>
              )}
            </section>
          )}
        </>
      )}
      <nav aria-label="Main navigation">
        {[
          [Home, "Home"],
          [Dumbbell, "Train"],
          [BookOpen, "Write"],
          [Library, "Library"],
          [UserRound, "Profile"],
        ].map(([Icon, label]) => {
          const NavIcon = Icon as typeof Home;
          return (
            <button
              key={String(label)}
              aria-current={view === label ? "page" : undefined}
              disabled={!ready}
              onClick={() => go(String(label))}
            >
              <NavIcon />
              {String(label)}
            </button>
          );
        })}
      </nav>
    </main>
  );
}
