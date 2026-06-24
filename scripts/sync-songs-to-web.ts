import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SONGS_PATH, WEB_SONGS_PATH } from "./paths.ts";

async function main() {
  const raw = await readFile(SONGS_PATH, "utf-8");
  await mkdir(dirname(WEB_SONGS_PATH), { recursive: true });
  await writeFile(WEB_SONGS_PATH, raw);
  console.log(`Synced ${SONGS_PATH} → ${WEB_SONGS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
