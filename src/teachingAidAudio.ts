import { playLocalAudio } from "./instructionAudio";
import manifestData from "./teachingAidAudioManifest.json";
import { TEACHING_AIDS, type TeachingAid, type TeachingAidStep } from "./teachingAids";

interface TeachingAidAudioEntry {
  id: string;
  text: string;
  src: string;
}

interface TeachingAidAudioManifest {
  provider?: string;
  entries: TeachingAidAudioEntry[];
}

const manifest = manifestData as TeachingAidAudioManifest;
const entries = new Map(manifest.entries.map((entry) => [entry.id, entry]));

export function teachingAidStepAudioId(aid: TeachingAid, step: TeachingAidStep): string {
  return aid.id + "-" + step.kind;
}

export function teachingAidStepAudioSrc(aid: TeachingAid, step: TeachingAidStep): string | null {
  return entries.get(teachingAidStepAudioId(aid, step))?.src ?? null;
}

export async function playTeachingAidStepAudio(aid: TeachingAid, step: TeachingAidStep): Promise<"audio" | "fallback" | "silent"> {
  return playLocalAudio(teachingAidStepText(step), teachingAidStepAudioSrc(aid, step));
}

export function teachingAidStepText(step: TeachingAidStep): string {
  return step.prompts.join(" ");
}

export function validateTeachingAidAudioManifest(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of manifest.entries) {
    if (!entry.id.trim()) {
      errors.push("Teaching aid audio entry is missing an id.");
    }
    if (ids.has(entry.id)) {
      errors.push("Duplicate teaching aid audio id: " + entry.id);
    }
    ids.add(entry.id);
    if (!entry.text.trim()) {
      errors.push("Teaching aid audio entry " + entry.id + " is missing text.");
    }
    if (!entry.src.startsWith("/audio/math/teaching/")) {
      errors.push("Teaching aid audio entry " + entry.id + " must use a local math teaching path.");
    }
  }

  if (manifest.entries.length === 0) {
    return errors;
  }

  for (const aid of TEACHING_AIDS) {
    for (const step of aid.steps) {
      const id = teachingAidStepAudioId(aid, step);
      const entry = entries.get(id);
      if (!entry) {
        errors.push("Missing teaching aid audio entry: " + id);
      } else if (entry.text !== teachingAidStepText(step)) {
        errors.push("Teaching aid audio text mismatch: " + id);
      }
    }
  }
  return errors;
}
