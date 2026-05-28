import { type RewardMedia } from "./rewardMedia";

export type RewardThemeId =
  | "kittens"
  | "dinosaurs"
  | "dinosaurStickers"
  | "starWars"
  | "monsterTrucks"
  | "constructionEquipment"
  | "bugs";
export type GiphyMediaKind = "gif" | "sticker";

export interface RewardTheme {
  id: RewardThemeId;
  label: string;
  provider: "local" | "giphy";
  giphyKind?: GiphyMediaKind;
  giphyIds?: string[];
}

export const REWARD_THEMES: RewardTheme[] = [
  { id: "kittens", label: "Kittens", provider: "local" },
  {
    id: "dinosaurs",
    label: "Dinosaurs",
    provider: "giphy",
    giphyKind: "gif",
    giphyIds: [
      "la8uEME0KVsDDcLbYf",
      "p0sdJ1L4RMlE71ewqs",
      "bvHPyaUsYQD0XWLr4u",
      "YedKG5mxnpDVuGztRy",
      "dJ3Fhbss0pegJE6h57",
      "WPtzVOKMymmZrJv8fO",
      "gjg9WBjncp08t3eEqm",
      "yHIghTSY2EelWIwx8p",
      "qZhFQqahkrjdncepRO",
      "CHmz8mMpCUW4p3vxRY"
    ]
  },
  {
    id: "dinosaurStickers",
    label: "Dinosaur stickers",
    provider: "giphy",
    giphyKind: "sticker",
    giphyIds: [
      "GzY0p4qzcu6USM9KdR",
      "Q8m694CkAPGhi5sB14",
      "ZigoTpbcfJuCZ3P963",
      "McPeQivEgrcmXKoZGS",
      "prrBXaSZbGu30a3RKJ",
      "9YqYFdSYv6NT9c2ajk",
      "QEwRY02WI4pTeXWUnm",
      "j2l2crFmnSNvyxl6lg",
      "XKZmTXZjS6zflsmf0f",
      "K66d6SvVjY7VC"
    ]
  },
  {
    id: "starWars",
    label: "Star Wars",
    provider: "giphy",
    giphyKind: "gif",
    giphyIds: [
      "bVuDlIxG65K8w",
      "H8a2kvphhXZde",
      "p5P3aRq6wimsM",
      "SW52VX6Xtzk1q",
      "rHR8qP1mC5V3G",
      "PKgfwX7ct5f5C",
      "M4PwO1pu5V9KM",
      "l3fZOD1W5s4o5GH1m",
      "mMx3LlKmU63Xq",
      "ZwxpIHk5LutMc"
    ]
  },
  {
    id: "monsterTrucks",
    label: "Monster trucks",
    provider: "giphy",
    giphyKind: "gif",
    giphyIds: [
      "SbtWxVHuEflDlhb7UT",
      "f8gb1lTKIc5W0",
      "fnaycX5ZOzUNq",
      "v4xuYcSiiMWOs",
      "xm0d7veyYm2xG",
      "deagt2CjcvZ8ZD0YeZ",
      "l46CjvSlDDs6GX6P6",
      "giIDYLDNblQZbSepnG",
      "SDxlhFmngqbbYX7YBi",
      "109psxMUin01by"
    ]
  },
  {
    id: "constructionEquipment",
    label: "Construction equipment",
    provider: "giphy",
    giphyKind: "gif",
    giphyIds: [
      "qWx5C3iSfwa6Q",
      "iMsyspBdgztDM4UMMB",
      "R5mMDQeIfJY46bSE1l",
      "ZXrApuGsX8USKxFUAU",
      "O5iY77hujNJF5CtK4N",
      "F92FgWCW4JjNdKzxX3",
      "Ih69aKJhN7EODT8VU1",
      "RG5JmiKquOgPz2NcTC",
      "kzy3wvP2ldpJMymEb6",
      "jq0YtI1fomMe8kflWE"
    ]
  },
  {
    id: "bugs",
    label: "Bugs",
    provider: "giphy",
    giphyKind: "gif",
    giphyIds: [
      "Utmbb7FyyTTXEWUAn7",
      "kPoGh51vLKuypsfbmR",
      "Kw9vARzlZFfo6lSLaz",
      "YrPCCrFKwd8NBCXJpk",
      "TjullGEWhilUoW4ND4",
      "7OM8aqLAr2xQ4",
      "QXJa2uAa44fYRSats0",
      "xUNd9RWEHxdCjSlQEE",
      "lQ0wJKU32bqGKuVMoq",
      "kzwO2XojID2kfRailP"
    ]
  }
];

export function normalizeRewardThemeId(value: unknown): RewardThemeId {
  return REWARD_THEMES.some((theme) => theme.id === value) ? value as RewardThemeId : "kittens";
}

export function rewardThemeById(value: unknown): RewardTheme {
  const id = normalizeRewardThemeId(value);
  return REWARD_THEMES.find((theme) => theme.id === id) ?? REWARD_THEMES[0];
}

export function normalizeHiddenRewardMediaIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = value.filter((item): item is string => typeof item === "string" && item.startsWith("giphy-"));
  return [...new Set(ids)].slice(0, 200);
}

export function giphyApiKey(): string {
  const env = (import.meta as ImportMeta & { env?: { VITE_GIPHY_API_KEY?: string } }).env;
  return env?.VITE_GIPHY_API_KEY?.trim() ?? "";
}

export async function loadGiphyRewardMedia(themeId: RewardThemeId): Promise<RewardMedia[]> {
  const theme = rewardThemeById(themeId);
  if (theme.provider !== "giphy" || !theme.giphyKind || !theme.giphyIds?.length) {
    return [];
  }
  const kind = theme.giphyKind;

  const apiKey = giphyApiKey();
  if (!apiKey) {
    return [];
  }

  const endpoint = "gifs";
  const params = new URLSearchParams({
    api_key: apiKey,
    ids: theme.giphyIds.join(","),
    rating: "g"
  });
  const response = await fetch("https://api.giphy.com/v1/" + endpoint + "?" + params.toString());
  if (!response.ok) {
    throw new Error("GIPHY request failed: " + String(response.status));
  }
  const payload = await response.json() as { data?: GiphyObject[] };
  return (payload.data ?? []).map((item) => toRewardMedia(item, kind)).filter((item): item is RewardMedia => Boolean(item));
}

interface GiphyObject {
  id?: string;
  title?: string;
  username?: string;
  rating?: string;
  images?: {
    fixed_width?: {
      mp4?: string;
      webp?: string;
      url?: string;
    };
    fixed_width_still?: {
      url?: string;
    };
  };
}

function toRewardMedia(item: GiphyObject, kind: GiphyMediaKind): RewardMedia | null {
  if (!item.id || item.rating !== "g") {
    return null;
  }
  const title = cleanTitle(item.title) || "Dinosaur reward";
  const artist = item.username ? "GIPHY / " + item.username : "GIPHY";
  const fixed = item.images?.fixed_width;
  if (kind === "sticker") {
    const src = fixed?.webp || fixed?.url;
    return src ? { id: "giphy-" + item.id, type: "image", title, src, artist, license: "Powered by GIPHY" } : null;
  }

  const src = fixed?.mp4;
  const poster = item.images?.fixed_width_still?.url || fixed?.webp || fixed?.url;
  return src && poster ? { id: "giphy-" + item.id, type: "video", title, src, poster, artist, license: "Powered by GIPHY" } : null;
}

function cleanTitle(value: unknown): string {
  return typeof value === "string" ? value.replace(/ GIF by .+$/i, "").replace(/ Sticker by .+$/i, "").trim().slice(0, 60) : "";
}
