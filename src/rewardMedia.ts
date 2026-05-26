export interface RewardMedia {
  id: string;
  type: "image" | "video";
  title: string;
  src: string;
  poster?: string;
  artist: string;
  license: string;
}

export const REWARD_MEDIA: RewardMedia[] = [
  {
    id: "pexels-kitten-01-12596743",
    type: "video",
    title: "Group Of Kittens Playing In A Yard",
    src: "./media/pexels-kittens/videos/pexels-kitten-01-12596743.mp4",
    poster: "./media/pexels-kittens/posters/pexels-kitten-01-12596743.jpg",
    artist: "Valdet Salihu",
    license: "Pexels License"
  }
];
