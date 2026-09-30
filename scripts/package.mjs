import { copyFile, mkdir, rm } from "node:fs/promises";

const output = new URL("../dist/timelog/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(
    new URL(`../${file}`, import.meta.url),
    new URL(`../dist/timelog/${file}`, import.meta.url)
  );
}

console.log("Packaged plugin at dist/timelog/");
