-- P29: optional account preferences only. This table contains neither delivery
-- tokens nor notification content, health readings, audience segments or rewards.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id),
  enabled boolean not null default false,
  reminder_time text not null default '19:00'
    check(length(reminder_time)=5 and reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_start text not null default '22:00'
    check(length(quiet_start)=5 and quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_end text not null default '08:00'
    check(length(quiet_end)=5 and quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'Asia/Hong_Kong' check(timezone='Asia/Hong_Kong'),
  revision integer not null check(revision>0),
  updated_at timestamptz not null default private.server_now(),
  check(quiet_start<>quiet_end),
  -- Fixed-width 24-hour clock strings compare chronologically. Quiet hours use
  -- [start,end): start is quiet; end is available, including an overnight window.
  check(not enabled or case when quiet_start<quiet_end
    then reminder_time<quiet_start or reminder_time>=quiet_end
    else reminder_time<quiet_start and reminder_time>=quiet_end end)
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select on public.notification_preferences to authenticated;
create policy active_own_notification_preferences on public.notification_preferences for select to authenticated
  using(user_id=(select auth.uid()) and (select private.account_active()));

create function private.notification_preferences_json(p public.notification_preferences) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('enabled',coalesce(p.enabled,false),'reminderTime',coalesce(p.reminder_time,'19:00'),
    'quietStart',coalesce(p.quiet_start,'22:00'),'quietEnd',coalesce(p.quiet_end,'08:00'),
    'timezone',coalesce(p.timezone,'Asia/Hong_Kong'),'revision',coalesce(p.revision,0),'updatedAt',p.updated_at);
$$;

create function public.hl_notification_preferences() returns jsonb language plpgsql security definer set search_path='' as $$
declare account public.profiles; preference public.notification_preferences;
begin
  -- Account validity is required; health, cloud and marketing choices are unrelated.
  account:=private.lock_account(false);
  select * into preference from public.notification_preferences where user_id=account.id;
  return private.notification_preferences_json(preference);
end $$;

create function public.hl_set_notification_preferences(p_enabled boolean,p_reminder_time text,p_quiet_start text,p_quiet_end text,p_timezone text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare account public.profiles; preference public.notification_preferences; current_state jsonb; desired_state jsonb;
  current_revision integer; pure_disable boolean;
begin
  account:=private.lock_account(false);
  if p_enabled is null or p_expected_revision is null or p_expected_revision<0 or p_timezone is distinct from 'Asia/Hong_Kong'
    or p_reminder_time is null or length(p_reminder_time)<>5 or p_reminder_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_quiet_start is null or length(p_quiet_start)<>5 or p_quiet_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_quiet_end is null or length(p_quiet_end)<>5 or p_quiet_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_quiet_start=p_quiet_end then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  if p_enabled and (case when p_quiet_start<p_quiet_end
    then p_reminder_time>=p_quiet_start and p_reminder_time<p_quiet_end
    else p_reminder_time>=p_quiet_start or p_reminder_time<p_quiet_end end) then
    raise exception using errcode='P0001',message='INVALID_INPUT';
  end if;
  select * into preference from public.notification_preferences where user_id=account.id;
  current_state:=private.notification_preferences_json(preference);
  current_revision:=(current_state->>'revision')::integer;
  desired_state:=jsonb_build_object('enabled',p_enabled,'reminderTime',p_reminder_time,'quietStart',p_quiet_start,'quietEnd',p_quiet_end,'timezone',p_timezone);
  if p_expected_revision>current_revision then raise exception using errcode='P0001',message='PREFERENCES_CONFLICT'; end if;
  -- A lost response can retry its identical desired state without changing time,
  -- version or rate budget. It cannot replay an old enable after a later disable.
  if desired_state=current_state-array['revision','updatedAt'] then return current_state; end if;
  if p_expected_revision<>current_revision or current_revision=2147483647 then
    raise exception using errcode='P0001',message='PREFERENCES_CONFLICT';
  end if;
  pure_disable:=(current_state->>'enabled')::boolean and not p_enabled
    and desired_state-'enabled'=current_state-array['enabled','revision','updatedAt'];
  if not pure_disable then perform private.rate_limit(account.id,'notification_preferences',20); end if;
  insert into public.notification_preferences(user_id,enabled,reminder_time,quiet_start,quiet_end,timezone,revision,updated_at)
    values(account.id,p_enabled,p_reminder_time,p_quiet_start,p_quiet_end,p_timezone,current_revision+1,private.server_now())
    on conflict(user_id) do update set enabled=excluded.enabled,reminder_time=excluded.reminder_time,
      quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,timezone=excluded.timezone,revision=excluded.revision,updated_at=excluded.updated_at
    returning * into preference;
  return private.notification_preferences_json(preference);
end $$;

revoke execute on function private.notification_preferences_json(public.notification_preferences) from public,anon,authenticated;
revoke execute on function public.hl_notification_preferences(),public.hl_set_notification_preferences(boolean,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hl_notification_preferences(),public.hl_set_notification_preferences(boolean,text,text,text,text,integer) to authenticated;

-- Preserve the complete P21 export and deletion behavior in this forward change.
create or replace function public.hl_export() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
  p:=private.lock_account(false); perform private.rate_limit(p.id,'export',2);
  return jsonb_build_object('exportedAt',private.server_now(),'profile',private.profile_json(p),
    'notificationPreferences',public.hl_notification_preferences(),
    'consentEvents',(select coalesce(jsonb_agg(to_jsonb(c)-'user_id'),'[]'::jsonb) from public.consent_events c where user_id=p.id),
    'activityRevisions',(select coalesce(jsonb_agg(to_jsonb(a)-'user_id'),'[]'::jsonb) from public.activity_submissions a where user_id=p.id),
    'activitySummaries',(select coalesce(jsonb_agg(to_jsonb(d)-'user_id'-'source_pin_token'),'[]'::jsonb) from public.daily_activity_summaries d where user_id=p.id),
    'missions',(select coalesce(jsonb_agg(to_jsonb(m)-'user_id'-'source_pin_token'),'[]'::jsonb) from public.mission_instances m where user_id=p.id),
    'ledger',(select coalesce(jsonb_agg(to_jsonb(l)-'account_key'),'[]'::jsonb) from public.point_ledger l where account_key=p.account_key),
    'appeals',(select coalesce(jsonb_agg(to_jsonb(a)-'user_id'),'[]'::jsonb) from public.appeals a where user_id=p.id),
    'appealAdjustments',(select coalesce(jsonb_agg(private.proposal_json(a)||jsonb_build_object('appealId',a.appeal_id,'taskDate',a.task_date) order by a.created_at,a.id),'[]'::jsonb) from private.appeal_adjustments a where user_id=p.id),
    'redemptions',(select coalesce(jsonb_agg(to_jsonb(r)-'user_id'),'[]'::jsonb) from public.redemptions r where user_id=p.id));
end $$;
create or replace function public.hl_purge_deletion(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.deletion_jobs; p public.profiles;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='P0001',message='FORBIDDEN'; end if;
  select * into j from public.deletion_jobs where id=p_job_id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select * into p from public.profiles where id=j.user_id for update;
  if p.status='active' then raise exception using errcode='P0001',message='DELETION_NOT_REQUESTED'; end if;
  delete from public.notification_preferences where user_id=p.id;
  delete from private.appeal_adjustments where user_id=p.id;
  delete from public.claim_requests where user_id=p.id;
  delete from public.activity_submissions where user_id=p.id;
  delete from public.daily_activity_summaries where user_id=p.id;
  delete from public.risk_flags where user_id=p.id;
  delete from public.mission_instances where user_id=p.id;
  delete from public.consent_events where user_id=p.id;
  delete from public.redemptions where user_id=p.id;
  delete from public.appeals where user_id=p.id;
  delete from private.rate_windows where user_id=p.id;
  delete from private.admin_roles where user_id=p.id;
  update public.profiles set account_key=null,status='deleted',adult_confirmed=false,cloud_sync=false,local_read=false,marketing=false,consent_version=null where id=p.id;
  return jsonb_build_object('jobId',j.id,'status','purged');
end $$;
