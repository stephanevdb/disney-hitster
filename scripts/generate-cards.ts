import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SongsFile } from "./types.ts";
import { GRID, PAGE_HEIGHT_MM, PAGE_WIDTH_MM } from "./card-layout.ts";
import { OUTPUT_DIR, SONGS_PATH, WEB_SONGS_PATH } from "./paths.ts";
import { buildPreviewPdf } from "./generate-preview.ts";
import { buildVerteLithPdf, buildSpotWhitePdf, buildFlatCmykPdf } from "./vertelith-pdf.ts";
import { buildThruCutPdf } from "./summa-cut-pdf.ts";

function parseArgs(argv: string[]) {
  let baseUrl = process.env.BASE_URL;
  let previewOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base-url" && argv[i + 1]) {
      baseUrl = argv[++i];
    } else if (argv[i] === "--preview-only") {
      previewOnly = true;
    }
  }
  return { baseUrl, previewOnly };
}

async function main() {
  const { baseUrl: cliBaseUrl, previewOnly } = parseArgs(process.argv.slice(2));
  const raw = await readFile(SONGS_PATH, "utf-8");
  const data = JSON.parse(raw) as SongsFile;
  const baseUrl = cliBaseUrl ?? data.baseUrl ?? "http://localhost:5173";

  if (baseUrl !== data.baseUrl) {
    data.baseUrl = baseUrl;
    await writeFile(SONGS_PATH, `${JSON.stringify(data, null, 2)}\n`);
  }

  const missingYoutube = data.songs.filter((s) => !s.youtubeId);
  if (missingYoutube.length > 0) {
    console.warn(
      `Warning: ${missingYoutube.length} songs lack youtubeId. Run npm run resolve-youtube first.`,
    );
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  if (!previewOnly) {
    const fronts = await buildVerteLithPdf(data.songs, baseUrl, "front");
    const backs = await buildVerteLithPdf(data.songs, baseUrl, "back");
    const whiteFronts = await buildSpotWhitePdf(data.songs, "front");
    const whiteBacks = await buildSpotWhitePdf(data.songs, "back");
    const thruCutFronts = await buildThruCutPdf(data.songs, "front");
    const thruCutBacks = await buildThruCutPdf(data.songs, "back");
    const flatFronts = await buildFlatCmykPdf(data.songs, baseUrl, "front");
    const flatBacks = await buildFlatCmykPdf(data.songs, baseUrl, "back");
    const frontsPath = `${OUTPUT_DIR}/disney-hitster-fronts-a1.pdf`;
    const backsPath = `${OUTPUT_DIR}/disney-hitster-backs-a1.pdf`;
    const whiteFrontsPath = `${OUTPUT_DIR}/disney-hitster-white-fronts-a1.pdf`;
    const whiteBacksPath = `${OUTPUT_DIR}/disney-hitster-white-backs-a1.pdf`;
    const thruCutFrontsPath = `${OUTPUT_DIR}/disney-hitster-thrucut-fronts-a1.pdf`;
    const thruCutBacksPath = `${OUTPUT_DIR}/disney-hitster-thrucut-backs-a1.pdf`;
    const flatFrontsPath = `${OUTPUT_DIR}/disney-hitster-fronts-flat-a1.pdf`;
    const flatBacksPath = `${OUTPUT_DIR}/disney-hitster-backs-flat-a1.pdf`;
    await writeFile(frontsPath, fronts);
    await writeFile(backsPath, backs);
    await writeFile(whiteFrontsPath, whiteFronts);
    await writeFile(whiteBacksPath, whiteBacks);
    await writeFile(thruCutFrontsPath, thruCutFronts);
    await writeFile(thruCutBacksPath, thruCutBacks);
    await writeFile(flatFrontsPath, flatFronts);
    await writeFile(flatBacksPath, flatBacks);
    console.log(`Generated ${frontsPath}`);
    console.log(`Generated ${backsPath}`);
    console.log(`Generated ${whiteFrontsPath}`);
    console.log(`Generated ${whiteBacksPath}`);
    console.log(`Generated ${thruCutFrontsPath}`);
    console.log(`Generated ${thruCutBacksPath}`);
    console.log(`Generated ${flatFrontsPath}`);
    console.log(`Generated ${flatBacksPath}`);
  }

  const previewBytes = await buildPreviewPdf(data.songs, baseUrl);
  const previewPath = `${OUTPUT_DIR}/disney-hitster-preview.pdf`;
  await writeFile(previewPath, previewBytes);
  console.log(`Generated ${previewPath}`);

  await mkdir(dirname(WEB_SONGS_PATH), { recursive: true });
  await writeFile(WEB_SONGS_PATH, `${JSON.stringify(data, null, 2)}\n`);

  console.log(`Synced songs to ${WEB_SONGS_PATH}`);
  console.log(`Base URL in QR codes: ${baseUrl}`);
  console.log(`Paper: A1 (${PAGE_WIDTH_MM}×${PAGE_HEIGHT_MM} mm), ${GRID.cols}×${GRID.rows} cards/page`);
  console.log("VerteLith: Spot_White, Spot_Varnish, CutContour in production PDFs");
  console.log("Summa: Thru-cut + Regmark in thrucut-fronts-a1.pdf and thrucut-backs-a1.pdf");
  console.log("Print fronts, flip short edge, print backs. White → CMYK → Varnish in VerteLith.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
