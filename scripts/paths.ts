import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = join(__dirname, "..");
export const DATA_DIR = join(ROOT_DIR, "data");
export const SONGS_PATH = join(DATA_DIR, "songs.json");
export const OUTPUT_DIR = join(ROOT_DIR, "output");
export const WEB_SONGS_PATH = join(ROOT_DIR, "web", "src", "data", "songs.json");
