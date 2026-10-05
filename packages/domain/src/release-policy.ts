import { z } from 'zod';

/** Reviewed build contract, not remotely configurable feature switches. */
export const IOS_RELEASE_POLICY = Object.freeze({
  policyVersion: 'ios-hk-health-points-v1',
  storefront: 'HK',
  features: Object.freeze({
    healthActivity: true, points: true, platformBadges: true,
    walletConnection: false, nftPurchases: false, cryptoRewards: false,
    rewardedAds: false, inAppPurchases: false, demoRedemptions: false,
  }),
} as const);
export const releasePolicySchema = z.strictObject({
  policyVersion: z.literal(IOS_RELEASE_POLICY.policyVersion),
  storefront: z.literal(IOS_RELEASE_POLICY.storefront),
  features: z.strictObject({
    healthActivity: z.literal(true), points: z.literal(true), platformBadges: z.literal(true),
    walletConnection: z.literal(false), nftPurchases: z.literal(false), cryptoRewards: z.literal(false),
    rewardedAds: z.literal(false), inAppPurchases: z.literal(false), demoRedemptions: z.literal(false),
  }),
});
export type ReleasePolicy = z.infer<typeof releasePolicySchema>;
