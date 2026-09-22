"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { milestones, streak, type RpgState } from "../lib/rpg";
import styles from "./RpgForge.module.css";
type Props = { state: RpgState; setState: Dispatch<SetStateAction<RpgState>> };
export function ProjectBar({
  state,
  setState,
  onSelect,
}: { onSelect: () => void } & Props) {
  const [name, setName] = useState("");
  return (
    <section className={`${styles.panel} ${styles.workspace}`}>
      <div className={styles.toolbar}>
        <select
          aria-label="Story project"
          value={state.activeProject}
          onChange={(e) => {
            setState((s) => ({ ...s, activeProject: e.target.value }));
            onSelect();
          }}
        >
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const project = state.projects.find(
              (p) => p.id === state.activeProject,
            );
            const title = window.prompt("Rename project", project?.title);
            if (title?.trim())
              setState((s) => ({
                ...s,
                projects: s.projects.map((p) =>
                  p.id === s.activeProject ? { ...p, title: title.trim() } : p,
                ),
              }));
          }}
        >
          Rename
        </button>
      </div>
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = crypto.randomUUID();
          setState((s) => ({
            ...s,
            projects: [...s.projects, { id, title: name.trim() }],
            activeProject: id,
          }));
          setName("");
          onSelect();
        }}
      >
        <input
          aria-label="New project name"
          placeholder="Begin another story…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <button>Create project</button>
      </form>
    </section>
  );
}
export function ProgressionTools({ state, setState }: Props) {
  const [label, setLabel] = useState(""),
    [kind, setKind] = useState<"Writing" | "Training" | "Hybrid">("Writing"),
    [target, setTarget] = useState(500),
    [xp, setXp] = useState(50);
  const [rules, setRules] = useState(state.rules),
    [notice, setNotice] = useState("");
  const level = Math.floor(state.xp / 1000) + 1;
  return (
    <>
      <section className={`${styles.panel} ${styles.workspace}`}>
        <h3>YOUR PROGRESSION</h3>
        <p>
          {streak(state)} day streak · {state.title}
        </p>
        <p className={styles.muted}>
          HP {100 + level * 10} · MP {100 + level * 10} — fantasy character
          capacity, not health measurements.
        </p>
        <div className={styles.badges}>
          {milestones(state).map((m) => (
            <span key={m.name} data-earned={m.earned}>
              {m.earned ? "✦" : "◇"} {m.name}
            </span>
          ))}
        </div>
        <div className={styles.form}>
          <label>
            Equipped title
            <select
              value={state.title}
              onChange={(e) =>
                setState((s) => ({ ...s, title: e.target.value }))
              }
            >
              {[
                "Wanderer",
                ...(level >= 2 ? ["Pathfinder"] : []),
                ...(level >= 5 ? ["Ascendant"] : []),
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Hero crest
            <select
              value={state.crest}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  crest: e.target.value as RpgState["crest"],
                }))
              }
            >
              <option>Sword</option>
              <option>Moon</option>
              <option>Sun</option>
            </select>
          </label>
        </div>
      </section>
      <section className={`${styles.panel} ${styles.workspace}`}>
        <h3>EXPERIENCE RULES</h3>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            setState((s) => ({ ...s, rules }));
            setNotice("Rules saved. Changes apply to future rewards.");
          }}
        >
          <div className={styles.fields}>
            {Object.entries({
              writing: "XP per 100 words",
              training: "XP for 10+ minutes",
              shortTraining: "XP for shorter workouts",
              writingCap: "Daily writing XP cap",
              trainingCap: "Daily training XP cap",
            }).map(([key, name]) => (
              <label key={key}>
                {name}
                <input
                  type="number"
                  required
                  min={0}
                  max={
                    key.endsWith("Cap") ? 5000 : key === "training" ? 1000 : 200
                  }
                  step={1}
                  value={rules[key as keyof typeof rules]}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, [key]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          </div>
          <button className={styles.primary}>Save XP rules</button>
          <p role="status">{notice}</p>
        </form>
      </section>
      <section className={`${styles.panel} ${styles.workspace}`}>
        <h3>CUSTOM DAILY QUESTS</h3>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            setState((s) => ({
              ...s,
              customQuests: [
                ...s.customQuests,
                {
                  id: crypto.randomUUID(),
                  label: label.trim(),
                  kind,
                  target,
                  xp,
                },
              ],
            }));
            setLabel("");
          }}
        >
          <label>
            Quest name
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label>
            Activity
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option>Writing</option>
              <option>Training</option>
              <option>Hybrid</option>
            </select>
          </label>
          <div className={styles.fields}>
            <label>
              {kind === "Writing"
                ? "New words"
                : kind === "Training"
                  ? "Training minutes"
                  : "Hybrid requires both default daily goals"}
              <input
                type="number"
                disabled={kind === "Hybrid"}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                min={1}
                max={100000}
                required
                step={1}
              />
            </label>
            <label>
              Reward XP
              <input
                type="number"
                value={xp}
                onChange={(e) => setXp(Number(e.target.value))}
                min={0}
                max={500}
                required
                step={1}
              />
            </label>
          </div>
          <button className={styles.primary}>Create daily quest</button>
        </form>
        {state.customQuests.map((q) => (
          <div className={styles.stat} key={q.id}>
            <span>
              {q.label} · {q.xp} XP
            </span>
            <button
              onClick={() =>
                setState((s) => ({
                  ...s,
                  customQuests: s.customQuests.filter((x) => x.id !== q.id),
                }))
              }
            >
              Remove quest
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
