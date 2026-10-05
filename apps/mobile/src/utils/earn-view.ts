import { weekStart } from '@healthloop/domain';
import type { MissionsResult } from '@healthloop/api-client';
import type { MetricResult } from '@healthloop/health-provider';

export type EarnAction = 'reconnect' | 'release' | 'reload' | 'consent' | 'read' | 'sync' | 'retry' | 'claim' | 'review' | 'rewards';
export type AppTab = 'home' | 'missions' | 'points' | 'profile';
export type ProfileSection = 'menu' | 'privacy' | 'reminders' | 'corrections' | 'data' | 'about';
export type Navigate = (tab: AppTab, profileSection?: ProfileSection) => void;
export interface EarnInput {
  date: string;
  snapshot: MissionsResult | null;
  eligible: MetricResult<number> | undefined;
  canSubmit: boolean;
  localAllowed: boolean;
  cloudReady: boolean;
  online: boolean;
  releaseReady: boolean;
  pendingDates: readonly string[];
}

/** Presentation only: previews never become balance, claim amount or completion flags. */
export function earnView(input: EarnInput) {
  const { snapshot, date } = input;
  const current = snapshot?.taskDate === date;
  const daily = current ? snapshot.items.find(m => m.kind === 'daily_steps' && m.periodStart === date) : undefined;
  const weekly = current ? snapshot.items.find(m => m.kind === 'weekly_consistency' && m.periodStart === weekStart(date)) : undefined;
  const steps = input.eligible?.status === 'present' ? input.eligible.value : null;
  const validSteps = steps !== null && Number.isSafeInteger(steps) && steps >= 0 ? steps : null;
  const entitlement = daily && validSteps !== null ? daily.tiers.reduce((value, tier) => validSteps >= tier.steps ? tier.points : value, 0) : null;
  const preview = entitlement !== null && daily ? Math.max(0, entitlement - daily.awardedPoints) : null;
  const nextTier = daily?.tiers.find(tier => validSteps !== null && tier.steps > validSteps);
  const goal = daily?.selectedGoal ?? null;
  const fraction = validSteps !== null && goal !== null ? Math.min(1, validSteps / goal) : null;
  // Only accepted server summaries can enable direct claims after an interrupted session.
  const acceptedEntitlement = daily?.eligibleSteps === null ? 0 : daily?.tiers.reduce((value,tier)=>(daily.eligibleSteps??0)>=tier.steps?tier.points:value,0)??0;
  const claimable = daily && !daily.pendingReview && acceptedEntitlement > daily.awardedPoints ? daily
    : weekly && !weekly.pendingReview && weekly.qualifyingDates.length >= weekly.weeklyDaysRequired && weekly.awardedPoints < weekly.weeklyBonusPoints ? weekly : undefined;
  const claimId = claimable && snapshot && Date.parse(snapshot.serverNow)<Date.parse(claimable.cutoffAt) ? claimable.id : null;
  let action: EarnAction;
  if (!input.online) action = 'reconnect';
  else if (!input.releaseReady) action = 'release';
  else if (!daily || !weekly) action = 'reload';
  else if (!input.localAllowed || !input.cloudReady) action = 'consent';
  else if (input.pendingDates.includes(date)) action = 'retry';
  else if (daily.pendingReview) action = 'review';
  else if (claimId) action = 'claim';
  else if (validSteps === null || !input.canSubmit) action = 'read';
  else if (preview! > 0 || daily.eligibleSteps !== validSteps
    || (weekly.qualifyingDates.length >= weekly.weeklyDaysRequired && weekly.awardedPoints < weekly.weeklyBonusPoints)) action = 'sync';
  else if (daily.awardedPoints > 0) action = 'rewards';
  else action = 'read';
  return { daily, weekly, steps: validSteps, preview, nextTier, goal, fraction, action, claimId };
}
