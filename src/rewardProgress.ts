import { type MathSettings } from "./mathEngine";
import { REWARD_MEDIA, type RewardMedia } from "./rewardMedia";

export const REVEAL_PIECES = 10;

export interface ActiveReward {
  media: RewardMedia;
  visiblePieces: number;
}

export function getActiveReward(totalRevealedPieces: number, mediaList: readonly RewardMedia[]): ActiveReward {
  const safeMediaList = mediaList.length > 0 ? mediaList : REWARD_MEDIA;
  const safePieces = Math.max(0, totalRevealedPieces);
  const forwardMediaIndex = safePieces === 0 ? 0 : Math.floor((safePieces - 1) / REVEAL_PIECES) % safeMediaList.length;
  const mediaIndex = (safeMediaList.length - 1 - forwardMediaIndex) % safeMediaList.length;
  const visiblePieces = safePieces === 0 ? 0 : ((safePieces - 1) % REVEAL_PIECES) + 1;
  return {
    media: safeMediaList[mediaIndex],
    visiblePieces
  };
}

export function visibleRewardMedia(settings: MathSettings, themedRewardMedia: readonly RewardMedia[]): RewardMedia[] {
  if (settings.rewardTheme === "kittens" || themedRewardMedia.length === 0) {
    return REWARD_MEDIA;
  }
  const visible = themedRewardMedia.filter((media) => !isHiddenRewardMediaId(settings, media.id));
  return visible.length > 0 ? [...visible] : REWARD_MEDIA;
}

export function isGiphyMedia(media: RewardMedia): boolean {
  return media.id.startsWith("giphy-") || media.license === "Powered by GIPHY";
}

export function isHiddenRewardMediaId(settings: MathSettings, id: string): boolean {
  return settings.hiddenRewardMediaIds.includes(id);
}

export function hideRewardMediaId(settings: MathSettings, id: string): MathSettings {
  return {
    ...settings,
    hiddenRewardMediaIds: [...new Set([...settings.hiddenRewardMediaIds, id])]
  };
}

export function restoreRewardMediaId(settings: MathSettings, id: string): MathSettings {
  return {
    ...settings,
    hiddenRewardMediaIds: settings.hiddenRewardMediaIds.filter((item) => item !== id)
  };
}
