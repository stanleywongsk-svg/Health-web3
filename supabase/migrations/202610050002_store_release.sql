-- Fixed Hong Kong iOS health/points release. No remote provider enable switches.
create function public.hl_app_capabilities() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.lock_account(false);
  return '{"policyVersion":"ios-hk-health-points-v1","storefront":"HK","features":{"healthActivity":true,"points":true,"platformBadges":true,"walletConnection":false,"nftPurchases":false,"cryptoRewards":false,"rewardedAds":false,"inAppPurchases":false,"demoRedemptions":false}}'::jsonb;
end $$;

create function public.hl_badges() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; first_day date; first_week date;
begin
  -- Existing awarded history remains readable after optional sync withdrawal.
  -- Profile locking serializes with compensation/deletion and posts nothing.
  p:=private.lock_account(false);
  select min(period_start) filter(where kind='daily_steps' and awarded_points>=10),
         min(period_start) filter(where kind='weekly_consistency' and awarded_points>=20)
    into first_day,first_week from public.mission_instances where user_id=p.id;
  return jsonb_build_object('items',jsonb_build_array(
    jsonb_build_object('id','first_steps','earned',first_day is not null,'earnedOn',first_day),
    jsonb_build_object('id','consistent_week','earned',first_week is not null,'earnedOn',first_week)
  ),'evaluatedAt',private.server_now());
end $$;

-- A separately named release RPC prevents an accidentally pointed demo backend
-- from exposing a spending catalogue through the real HTTP surface.
create function public.hl_release_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.lock_account(false);
  return '{"items":[]}'::jsonb;
end $$;
create or replace function public.hl_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.lock_account(false);
  if not exists(select 1 from private.system_settings where singleton and demo_mode and project_label like 'healthloop-local-%') then
    return '{"items":[]}'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'titleKey',title_key,'pointsCost',points_cost,'stock',stock,'isDemo',is_demo) order by id),'[]'::jsonb)
    into result from public.reward_catalog where active;
  return jsonb_build_object('items',result);
end $$;

-- Real-build POST /redemptions can only reconcile a previously committed key.
create function public.hl_reconcile_redemption(p_reward_id uuid,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; d public.redemptions;
begin
  p:=private.lock_account(false);
  if p_reward_id is null or p_idempotency_key is null then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  select * into d from public.redemptions where user_id=p.id and idempotency_key=p_idempotency_key;
  if not found then raise exception using errcode='P0001',message='NOT_SUPPORTED'; end if;
  if d.reward_id<>p_reward_id then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('id',d.id,'status',d.status,'demoCode',d.demo_code,'pointsCost',d.points_cost);
end $$;

create or replace function public.hl_redeem(p_reward_id uuid,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; r public.reward_catalog; d public.redemptions;
begin
  p:=private.lock_account(false);
  if p_reward_id is null or p_idempotency_key is null then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  select * into d from public.redemptions where user_id=p.id and idempotency_key=p_idempotency_key;
  if found then
    if d.reward_id<>p_reward_id then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',d.id,'status',d.status,'demoCode',d.demo_code,'pointsCost',d.points_cost);
  end if;
  -- Replays above remain recoverable after this release removes new demo spending.
  perform 1 from private.system_settings where singleton and demo_mode and project_label like 'healthloop-local-%' for share;
  if not found then raise exception using errcode='P0001',message='NOT_SUPPORTED'; end if;
  if not p.adult_confirmed or not p.cloud_sync then raise exception using errcode='P0001',message='CONSENT_REQUIRED'; end if;
  perform 1 from private.system_settings where singleton and not rewards_paused for share;
  if not found then raise exception using errcode='P0001',message='REWARDS_PAUSED'; end if;
  perform private.rate_limit(p.id,'redeem',20);
  select * into r from public.reward_catalog where id=p_reward_id and active for update;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  if r.stock<=0 then raise exception using errcode='P0001',message='OUT_OF_STOCK'; end if;
  if private.balance(p.account_key)<r.points_cost then raise exception using errcode='P0001',message='INSUFFICIENT_POINTS'; end if;
  insert into public.redemptions(user_id,reward_id,idempotency_key,points_cost) values(p.id,r.id,p_idempotency_key,r.points_cost) returning * into d;
  update public.reward_catalog set stock=stock-1 where id=r.id;
  insert into public.point_ledger(account_key,kind,points,redemption_id) values(p.account_key,'redemption',-r.points_cost,d.id);
  return jsonb_build_object('id',d.id,'status',d.status,'demoCode',d.demo_code,'pointsCost',d.points_cost);
end $$;

revoke all on function public.hl_app_capabilities(),public.hl_badges(),public.hl_release_rewards(),public.hl_reconcile_redemption(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hl_app_capabilities(),public.hl_badges(),public.hl_release_rewards(),public.hl_reconcile_redemption(uuid,uuid) to authenticated;
