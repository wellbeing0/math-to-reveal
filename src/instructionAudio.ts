import manifestData from "./instructionAudioManifest.json";

interface InstructionAudioEntry {
  id: string;
  text: string;
  src: string;
}

interface InstructionAudioManifest {
  entries: InstructionAudioEntry[];
}

const manifest = manifestData as InstructionAudioManifest;
const entries = new Map(manifest.entries.map((entry) => [entry.id, entry]));
let activeAudio: HTMLAudioElement | null = null;
let activeCancel: (() => void) | null = null;

export function instructionAudioSrc(id: string | undefined): string | null {
  return id ? entries.get(id)?.src ?? null : null;
}

export function validateInstructionAudioManifest(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of manifest.entries) {
    if (!entry.id.trim()) {
      errors.push("Instruction audio entry is missing an id.");
    }
    if (ids.has(entry.id)) {
      errors.push("Duplicate instruction audio id: " + entry.id);
    }
    ids.add(entry.id);
    if (!entry.text.trim()) {
      errors.push("Instruction audio entry " + entry.id + " is missing text.");
    }
    if (!entry.src.startsWith("/audio/math/instructions/")) {
      errors.push("Instruction audio entry " + entry.id + " must use a local math instruction path.");
    }
  }
  return errors;
}

export async function playInstructionAudio(text: string, audioInstructionId?: string): Promise<"audio" | "fallback" | "silent"> {
  cancelInstructionAudio();
  const src = instructionAudioSrc(audioInstructionId);
  if (src) {
    return playLocalAudio(text, src);
  }

  speakWithBrowserVoice(text);
  return "fallback";
}

export async function playLocalAudio(text: string, src: string | null | undefined): Promise<"audio" | "fallback" | "silent"> {
  cancelInstructionAudio();
  if (src) {
    try {
      const audio = new Audio(publicAssetSrc(src));
      activeAudio = audio;
      await playAudio(audio);
      return "audio";
    } catch {
      speakWithBrowserVoice(text);
      return "fallback";
    }
  }

  if (text.trim()) {
    speakWithBrowserVoice(text);
    return "fallback";
  }
  return "silent";
}

function publicAssetSrc(src: string): string {
  if (!src.startsWith("/")) {
    return src;
  }
  return new URL(src.slice(1), window.location.href).toString();
}

export function cancelInstructionAudio(): void {
  const audio = activeAudio;
  const cancel = activeCancel;
  activeAudio = null;
  activeCancel = null;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  cancel?.();
  window.speechSynthesis?.cancel();
}

function playAudio(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (activeCancel === onCancel) {
        activeCancel = null;
      }
      if (activeAudio === audio) {
        activeAudio = null;
      }
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onCancel = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Instruction audio failed."));
    };
    activeCancel = onCancel;
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.play().catch((error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Instruction audio failed."));
    });
  });
}

function speakWithBrowserVoice(text: string): void {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.82;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
