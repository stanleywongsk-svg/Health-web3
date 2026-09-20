-- Forward-only repair: preserve grants, account locks, pinned instances and posted history.
-- No existing records or published mission versions are rewritten.

create or replace function public.hl_set_consents(p_adult_confirmed boolean,p_local_read boolean,p_cloud_sync boolean,p_marketing boolean,p_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=private.require_user(); p public.profiles; reduces_access boolean; increases_access boolean;
begin
  if p_adult_confirmed is distinct from true or p_local_read is null or p_cloud_sync is null or p_marketing is null or p_version is distinct from '2026-09-18' then
    raise exception using errcode='P0001',message='INVALID_INPUT';
  end if;
  insert into public.profiles(id) values(v_id) on conflict(id) do nothing;
  p:=private.lock_account(false);
  -- Withdrawal must remain available when the ordinary mutation budget is exhausted.
  -- Mixed requests that grant any permission are still upgrades; clients can revoke
  -- first, then submit a separately authorized grant after the rate window resets.
  reduces_access:=(p.local_read and not p_local_read) or (p.cloud_sync and not p_cloud_sync) or (p.marketing and not p_marketing);
  increases_access:=(p_local_read and not p.local_read) or (p_cloud_sync and not p.cloud_sync) or (p_marketing and not p.marketing);
  if not reduces_access or increases_access then
    perform private.rate_limit(p.id,'consent',20);
  end if;
  update public.profiles set adult_confirmed=true,local_read=p_local_read,cloud_sync=p_cloud_sync,marketing=p_marketing,consent_version=p_version
    where id=p.id returning * into p;
  insert into public.consent_events(user_id,version,adult_confirmed,local_read,cloud_sync,marketing)
    values(p.id,p_version,true,p_local_read,p_cloud_sync,p_marketing);
  return jsonb_build_object('profile',private.profile_json(p));
end $$;

create or replace function public.hl_claim(p_instance_id uuid,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; m public.mission_instances; w public.mission_instances; v public.mission_versions; weekly_rules public.mission_versions; s public.daily_activity_summaries;
  r public.claim_requests; t timestamptz; total integer; delta integer:=0; bonus integer:=0; days integer; outcome jsonb;
begin
  p:=private.lock_account(true);
  if p_instance_id is null or p_idempotency_key is null then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  select * into r from public.claim_requests where user_id=p.id and idempotency_key=p_idempotency_key;
  if found then
    if r.instance_id<>p_instance_id then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return r.outcome;
  end if;
  perform 1 from private.system_settings where singleton and not rewards_paused for share;
  if not found then raise exception using errcode='P0001',message='REWARDS_PAUSED'; end if;
  t:=private.server_now();
  select * into m from public.mission_instances where id=p_instance_id and user_id=p.id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select * into v from public.mission_versions where version=m.rule_version;
  if t>=private.cutoff(case when m.kind='daily_steps' then m.period_start else m.period_start+6 end,v.late_cutoff) then raise exception using errcode='P0001',message='CUTOFF_PASSED'; end if;
  if m.kind='daily_steps' then
  select * into s from public.daily_activity_summaries where user_id=p.id and task_date=m.period_start;
  if not found then raise exception using errcode='P0001',message='SUMMARY_REQUIRED'; end if;
  -- Rate check only new requests; a replay cannot consume another reward.
  perform private.rate_limit(p.id,'claim',120);
  total:=private.entitlement(s.eligible_steps); delta:=greatest(0,total-m.awarded_points);
  if delta>0 then
    insert into public.point_ledger(account_key,kind,points,instance_id,entitlement_total) values(p.account_key,'daily_award',delta,m.id,total);
    update public.mission_instances set awarded_points=total where id=m.id;
  end if;
  w:=private.ensure_mission(p.id,'weekly_consistency',private.week_start(m.period_start));
  else w:=m; total:=0; perform private.rate_limit(p.id,'claim',120); end if;
  select * into weekly_rules from public.mission_versions where version=w.rule_version;
  select count(*) into days from public.daily_activity_summaries d join public.mission_instances i
    on i.user_id=d.user_id and i.period_start=d.task_date and i.kind='daily_steps'
    where d.user_id=p.id and d.task_date between w.period_start and w.period_start+6 and d.eligible_steps>=w.selected_goal;
  -- A daily task can use a later published cutoff than its already-pinned week.
  -- A closed week must not be reopened by the daily task's implicit bonus path.
  -- The independently eligible daily award remains posted in this transaction.
  if days>=weekly_rules.weekly_days and w.awarded_points=0 and t<private.cutoff(w.period_start+6,weekly_rules.late_cutoff) then
    bonus:=weekly_rules.weekly_points;
    insert into public.point_ledger(account_key,kind,points,instance_id,entitlement_total) values(p.account_key,'weekly_award',bonus,w.id,bonus);
    update public.mission_instances set awarded_points=bonus where id=w.id;
  end if;
  outcome:=jsonb_build_object('instanceId',m.id,'addedPoints',delta+bonus,'dailyAwardedPoints',case when m.kind='daily_steps' then greatest(total,m.awarded_points) else 0 end,
    'weeklyAwardedPoints',w.awarded_points+bonus,'balance',private.balance(p.account_key));
  insert into public.claim_requests(user_id,idempotency_key,instance_id,outcome) values(p.id,p_idempotency_key,m.id,outcome);
  return outcome;
end $$;

