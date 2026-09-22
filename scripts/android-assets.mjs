import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const res = resolve("android/app/src/main/res");
const vector = `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512"><path android:fillColor="#0e0b12" android:pathData="M0,0h512v512h-512z"/><path android:fillColor="#752a3e" android:pathData="M241,268C164,224 123,151 92,107C81,190 99,258 174,296L111,268C140,332 183,356 237,353L180,332L241,321Z"/><path android:fillColor="#f4d698" android:pathData="M271,268C348,224 389,151 420,107C431,190 413,258 338,296L401,268C372,332 329,356 275,353L332,332L271,321Z"/><path android:fillColor="#fff4d6" android:pathData="M256,112L270,175L263,322L256,381L249,322L242,175Z"/><path android:fillColor="#c69a53" android:pathData="M211,288L256,278L301,288L298,300L263,294L263,367L273,383L256,405L239,383L249,367L249,294L214,300Z"/></vector>`;
function write(path, text) {
  const full = resolve(res, path);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, text);
}
write("drawable/redbound_crest.xml", vector);
for (const name of ["ic_launcher", "ic_launcher_round"]) {
  write(`mipmap-anydpi/${name}.xml`, vector);
  write(
    `mipmap-anydpi-v26/${name}.xml`,
    `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@drawable/redbound_crest"/><foreground android:drawable="@drawable/redbound_crest"/></adaptive-icon>`,
  );
}
console.log("Installed Redbound light and dark wing launcher icons.");
