# RPG Writer + Training App — Implementation Brief

Build the next version of this repository as a mobile-first RPG experience that combines **novel creation** and **real-world workout progression** into one shared leveling system.

## Core fantasy
The user is the hero. Writing develops the mind; training develops the body. Both paths feed the same character progression.

Use the supplied light-versus-darkness concept art as the visual direction: black cinematic backgrounds, warm gold/ivory light, crimson-red darkness, gothic fantasy framing, luminous borders, angelic white wings opposed by dark crimson wings, and premium RPG HUD typography. The app icon/logo should be a split light/dark crest: one white/gold angel wing and one black/crimson fallen wing around a central sword/star/sigil. Keep the interface readable and responsive rather than treating the concept image as a flat screenshot.

## Main dashboard
Create a mobile RPG dashboard with:
- Greeting + player title
- Level, total EXP, animated EXP bar
- HP and MP
- RPG stats: Strength, Endurance, Focus, Creativity, Discipline, Wisdom
- Two major actions: **Train** and **Write**
- Daily quests combining physical and creative objectives
- Streaks, achievements, titles, quest completion animation, level-up animation
- Bottom navigation: Home, Train, Write, Library, Profile

## Shared progression
Every meaningful action can award configurable EXP. Avoid rewarding spam; use daily caps and meaningful thresholds.

Example defaults:
- Complete a workout: +100 EXP
- Write 300 words: +60 EXP
- Read/edit a meaningful note: +40 EXP
- 10 minutes stretching: +20 EXP
- Plan the next chapter: +40 EXP
- Complete a combined Train + Write daily quest: bonus EXP
- Longer writing sessions can increase Creativity/Focus/Wisdom.
- Strength workouts can increase Strength; cardio Endurance; consistency Discipline.
- Allow custom quests and custom EXP rules.

Support three progression styles: writing-only, workout-only, or hybrid. Neither side should be mandatory.

## Writing / novel studio
Include Projects, Notes, Brainstorming, Outlines, Characters, Worldbuilding, Locations, Lore, Power Systems, Plot Development, Themes, Research, Rough Draft chapters and Final Draft chapters. Everything must be editable, autosaved, searchable and organized into custom sections. Track word counts and writing sessions. Notes and writing activity should feed RPG progression without encouraging meaningless text.

## Training
Create workout logging for strength, cardio, HIIT, flexibility and custom workouts. Support exercises, sets, reps, weight, duration, distance, rest, notes, templates, personal records and workout history. Show which character stats each activity affects. Include sensible manual correction/editing of logged workouts.

## Character / profile
Show the user's RPG avatar/profile, level, EXP, HP/MP, attributes, achievements, titles, streaks, completed quests, writing totals and training totals. Add cosmetic unlocks as progression rewards.

## Light vs Darkness theme
Make the visual identity a duality system, not a morality judgment. Users can choose Light, Darkness or Balanced cosmetic alignment. Light uses ivory/gold glow and angelic motifs. Darkness uses black/crimson glow and fallen-wing motifs. Balanced uses the split crest. Alignment changes visuals and unlockable cosmetics, not access to core features.

## Data and offline behavior
Mobile-first, fast and fluid. Persist drafts and workout logs locally/offline first, then sync when online if cloud storage is configured. Never lose an unfinished writing session. Include import/export of user data.

## Android / APK / GitHub
This repository must remain the source of truth. Keep the web app functional and package the mobile build with Capacitor for Android. Maintain Android-ready configuration and GitHub Actions that can build a debug APK on pushes/workflow dispatch and expose it as a downloadable workflow artifact. Do not commit signing keys, API secrets, or private credentials. Document local Android build steps and release-signing requirements in README.

## Quality bar
The result should feel like a premium fantasy RPG, not a generic fitness dashboard with a fantasy skin. Use polished micro-interactions, responsive layouts, subtle particles/glows, tactile cards and clear accessibility. Preserve performance on ordinary Android phones. Respect reduced-motion settings.

Build iteratively and keep the project runnable after each change.