/**
 * P0.17 — Honest Meta surface readiness from image dimensions.
 * No silent crop / stretch. Reuses creativita ratio tolerances.
 */

import {
  aspectRatioMetaOk,
  aspectRatioOrizzontale,
  aspectRatioStoriesOk,
} from "@/lib/creativita";
import type {
  CreativeFormatReadiness,
  CreativeSurfaceReadiness,
} from "@/lib/meta/creative/types";

const TOL_SQUARE = 0.08;
const TOL_45 = 0.06;
const RATIO_45 = 4 / 5;

function classify1x1(ratio: number): CreativeSurfaceReadiness {
  if (Math.abs(ratio - 1) <= TOL_SQUARE) return "AVAILABLE";
  if (Math.abs(ratio - RATIO_45) <= TOL_45) return "SUBOPTIMAL";
  if (aspectRatioStoriesOk(100, Math.round(100 / ratio))) return "SUBOPTIMAL";
  return "MISSING_FORMAT";
}

function classify4x5(ratio: number): CreativeSurfaceReadiness {
  if (Math.abs(ratio - RATIO_45) <= TOL_45) return "AVAILABLE";
  if (Math.abs(ratio - 1) <= TOL_SQUARE) return "SUBOPTIMAL";
  return "MISSING_FORMAT";
}

function classify9x16(width: number, height: number): CreativeSurfaceReadiness {
  if (aspectRatioStoriesOk(width, height)) return "AVAILABLE";
  if (aspectRatioMetaOk(width, height)) return "SUBOPTIMAL";
  return "MISSING_FORMAT";
}

function summaryIt(r: CreativeFormatReadiness): string {
  // No media / unknown size: stay silent in Facile — not a useful user message.
  if (r.ratio == null) return "";
  const feedOk =
    r.feed1x1 === "AVAILABLE" ||
    r.feed4x5 === "AVAILABLE" ||
    r.feed1x1 === "SUBOPTIMAL" ||
    r.feed4x5 === "SUBOPTIMAL";
  const storiesOk = r.stories9x16 === "AVAILABLE";
  if (feedOk && storiesOk) {
    return "Formato utilizzabile per Feed e Stories/Reels.";
  }
  if (feedOk && r.stories9x16 === "SUBOPTIMAL") {
    return "Va bene per Feed; per Stories/Reels un formato verticale funzionerebbe meglio.";
  }
  if (feedOk && r.stories9x16 === "MISSING_FORMAT") {
    return "Va bene per Feed; Stories/Reels preferiscono un’immagine verticale.";
  }
  if (aspectRatioOrizzontale(100, Math.round(100 / (r.ratio || 1)))) {
    return "Formato orizzontale: meno adatto a Feed e Stories.";
  }
  return "Formato da verificare per i posizionamenti scelti.";
}

export function analyzeCreativeFormatReadiness(input: {
  width?: number | null;
  height?: number | null;
}): CreativeFormatReadiness {
  const w = input.width != null ? Number(input.width) : 0;
  const h = input.height != null ? Number(input.height) : 0;
  if (!(w > 0 && h > 0)) {
    return {
      ratio: null,
      feed1x1: "UNKNOWN",
      feed4x5: "UNKNOWN",
      stories9x16: "UNKNOWN",
      summaryIt: "",
    };
  }
  const ratio = w / h;
  const readiness: CreativeFormatReadiness = {
    ratio,
    feed1x1: classify1x1(ratio),
    feed4x5: classify4x5(ratio),
    stories9x16: classify9x16(w, h),
    summaryIt: "",
  };
  readiness.summaryIt = summaryIt(readiness);
  return readiness;
}
