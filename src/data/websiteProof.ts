// Only publish owner-approved evidence. Empty entries deliberately render nothing.
export type CustomerStory = {
  name: string;
  role: string;
  market: string;
  quote: string;
  photoUrl: string;
};

export const customerStories: CustomerStory[] = [];
export const usageProof: { count: number; label: string; asOf: string } | null = null;
export const founderProof: { name: string; story: string; photoUrl: string; profileUrl: string } | null = null;
export const thirdPartyProof: { title: string; url: string; date: string }[] = [];