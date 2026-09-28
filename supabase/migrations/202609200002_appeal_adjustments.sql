-- Reviewed corrections reference an existing risk submission, never caller-supplied
-- steps or points. Profile locks serialize claims, corrections, consent, redemption
-- and deletion. Multiple-person operations lock profiles in UUID order FIRST.

alter table public.appeals add column sequence_id bigint generated always as identity unique;
alter table public.mission_instances add column posting_epoch integer not null default 0 check(posting_epoch>=0);
alter table public.point_ledger add column posting_epoch integer not null default 0 check(posting_epoch>=0);
alter table public.point_ledger add column adjustment_id uuid;
alter table public.point_ledger add column related_entry_id bigint references public.point_ledger(id);
alter table public.point_ledger drop constraint point_ledger_account_key_instance_id_entitlement_total_key;
alter table public.point_ledger add unique(account_key,instance_id,posting_epoch,entitlement_total);
alter table public.point_ledger drop constraint point_ledger_kind_check;
alter table public.point_ledger drop constraint point_ledger_check;
alter table public.point_ledger drop constraint point_ledger_check1;
alter table public.point_ledger add constraint ledger_kind check(kind in ('daily_award','weekly_award','redemption','refund','daily_correction','weekly_correction'));
alter table public.point_ledger add constraint ledger_sign check(
  (kind in ('daily_award','weekly_award','refund') and points>0) or (kind='redemption' and points<0)
  or kind in ('daily_correction','weekly_correction'));
alter table public.point_ledger add constraint ledger_shape check(
  (kind in ('daily_award','weekly_award') and instance_id is not null and entitlement_total is not null and redemption_id is null and adjustment_id is null and related_entry_id is null)
  or (kind in ('daily_correction','weekly_correction') and instance_id is not null and entitlement_total is not null and redemption_id is null and adjustment_id is not null)
  or (kind in ('redemption','refund') and redemption_id is not null and instance_id is null and entitlement_total is null and adjustment_id is null and related_entry_id is null));
create unique index ledger_adjustment_once on public.point_ledger(adjustment_id,kind) where adjustment_id is not null;

create table private.appeal_adjustments (
  id uuid primary key default gen_random_uuid(),
  appeal_id uuid not null references public.appeals(id),
  user_id uuid not null references public.profiles(id),
  task_date date not null,
  revision integer not null check(revision>0),
  proposer_id uuid not null,
  proposal_key uuid not null,
  proposal_reason text not null check(length(proposal_reason) between 10 and 1000),
  baseline jsonb not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewer_id uuid,
  decision_key uuid,
  decision text check(decision in ('approve','reject')),
  decision_reason text check(length(decision_reason) between 10 and 1000),
  decision_outcome jsonb,
  created_at timestamptz not null default private.server_now(),
  decided_at timestamptz,
  unique(proposer_id,proposal_key),
  unique(reviewer_id,decision_key),
  check(proposer_id<>user_id and (reviewer_id is null or (reviewer_id<>proposer_id and reviewer_id<>user_id))),
  check((status='pending' and reviewer_id is null and decision is null and decision_key is null and decision_reason is null and decided_at is null and decision_outcome is null)
    or (status in ('approved','rejected') and reviewer_id is not null and decision_key is not null and decision_reason is not null and decided_at is not null and decision_outcome is not null
      and ((status='approved' and decision='approve') or (status='rejected' and decision='reject'))))
);
create index adjustments_subject_day on private.appeal_adjustments(user_id,task_date);
create index adjustments_appeal on private.appeal_adjustments(appeal_id,created_at);
alter table private.appeal_adjustments enable row level security;
revoke all on private.appeal_adjustments from public,anon,authenticated;
-- The immutable audit contains no free-text health reason or subject identifier.
-- Its digest proves the reason in the separately retained adjustment record. Opaque
-- business identities remain pseudonymous, not guaranteed anonymous, after erasure.
alter table private.admin_audit add column adjustment_id uuid;
alter table private.admin_audit add column reason_digest text;

create function private.protect_adjustment() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status<>'pending' or (to_jsonb(new)-array['status','reviewer_id','decision_key','decision','decision_reason','decision_outcome','decided_at'])
    is distinct from (to_jsonb(old)-array['status','reviewer_id','decision_key','decision','decision_reason','decision_outcome','decided_at']) then
    raise exception using errcode='P0001',message='IMMUTABLE_RECORD';
  end if;
  return new;
end $$;
create trigger adjustment_history before update on private.appeal_adjustments for each row execute function private.protect_adjustment();
-- Original submission outcomes remain the original transport receipt, even after
-- review. Current accepted state and review status have separate read endpoints.
create trigger submission_history before update on public.activity_submissions for each row execute function private.immutable_record();

create function private.require_review_role(p_role text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_user();
begin
  if not exists(select 1 from public.profiles where id=actor and status='active') then
    raise exception using errcode='P0001',message='ACCOUNT_INACTIVE';
  end if;
  if auth.jwt()->>'aal' is distinct from 'aal2' or not exists(
    select 1 from private.admin_roles where user_id=actor and (p_role is null or role=p_role)) then
    raise exception using errcode='P0001',message='FORBIDDEN';
  end if;
  return actor;
end $$;
create function private.lock_review_accounts(p_subject uuid,p_role text) returns public.profiles language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_review_role(p_role); subject public.profiles;
begin
  if actor=p_subject then raise exception using errcode='P0001',message='SELF_REVIEW'; end if;
  perform id from public.profiles where id in (actor,p_subject) order by id for update;
  -- Recheck after any lock wait: a previously valid JWT/role cannot revive deletion.
  perform private.require_review_role(p_role);
  perform 1 from private.admin_roles where user_id=actor and role=p_role for share;
  if not found then raise exception using errcode='P0001',message='FORBIDDEN'; end if;
  select * into subject from public.profiles where id=p_subject;
  if not found or subject.status<>'active' then raise exception using errcode='P0001',message='ACCOUNT_INACTIVE'; end if;
  if not subject.adult_confirmed or not subject.cloud_sync then raise exception using errcode='P0001',message='CONSENT_REQUIRED'; end if;
  return subject;
end $$;
create function private.review_baseline(p_user uuid,p_day date) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'latestRevision',(select max(revision) from public.activity_submissions where user_id=p_user and task_date=p_day),
    'summaries',(select coalesce(jsonb_agg(to_jsonb(s)-'user_id' order by task_date),'[]'::jsonb)
      from public.daily_activity_summaries s where user_id=p_user and task_date between private.week_start(p_day) and private.week_start(p_day)+6),
    'missions',(select coalesce(jsonb_agg(to_jsonb(m)-'user_id' order by period_start,kind),'[]'::jsonb)
      from public.mission_instances m where user_id=p_user and period_start between private.week_start(p_day) and private.week_start(p_day)+6));
$$;
create function private.proposal_json(a private.appeal_adjustments) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',a.id,'revision',a.revision,'status',a.status,'proposalReason',a.proposal_reason,
    'decisionReason',a.decision_reason,'createdAt',a.created_at,'decidedAt',a.decided_at);
$$;
create function private.appeal_json(a public.appeals) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',a.id,'sequenceId',a.sequence_id::text,'taskDate',a.task_date,'reason',a.reason,'status',a.status,'createdAt',a.created_at,
    'proposals',(select coalesce(jsonb_agg(private.proposal_json(p) order by p.created_at,p.id),'[]'::jsonb) from private.appeal_adjustments p where p.appeal_id=a.id));
$$;
create function public.hl_appeals(p_limit integer default 20,p_cursor bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; result jsonb; n integer; last_id bigint;
begin
  p:=private.lock_account(false);
  if p_limit is null or p_limit not between 1 and 100 or (p_cursor is not null and p_cursor<=0) then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  select coalesce(jsonb_agg(private.appeal_json(page) order by sequence_id desc),'[]'::jsonb),count(*),min(sequence_id)
    into result,n,last_id from (select a.* from public.appeals a where user_id=p.id and (p_cursor is null or sequence_id<p_cursor) order by sequence_id desc limit p_limit) page;
  return jsonb_build_object('items',result,'nextCursor',case when n=p_limit then last_id::text else null end);
end $$;
create function public.hl_admin_appeals(p_limit integer default 20,p_cursor bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb; n integer; last_id bigint;
begin
  -- Only the actor row is locked for this read; it never subsequently locks subjects.
  perform private.lock_account(false); actor:=private.require_review_role();
  if p_limit is null or p_limit not between 1 and 100 or (p_cursor is not null and p_cursor<=0) then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  select coalesce(jsonb_agg(private.appeal_json(page)||jsonb_build_object('subjectId',user_id,
      'canonicalSummary',(select jsonb_build_object('eligibleSteps',s.eligible_steps,'revision',s.revision) from public.daily_activity_summaries s where s.user_id=page.user_id and s.task_date=page.task_date),
      'pendingSubmissions',(select coalesce(jsonb_agg(jsonb_build_object('revision',s.revision,'eligibleSteps',(s.payload->>'eligibleSteps')::integer,
        'sourceCategory',s.payload->>'sourceCategory','observedAt',s.payload->>'observedAt','reason',r.reason) order by s.revision desc),'[]'::jsonb)
        from public.activity_submissions s join public.risk_flags r using(user_id,task_date,revision)
        where s.user_id=page.user_id and s.task_date=page.task_date and s.outcome->>'status'='pending_review' and r.status='pending')) order by sequence_id desc),'[]'::jsonb),count(*),min(sequence_id)
    into result,n,last_id from (select a.* from public.appeals a join public.profiles p on p.id=a.user_id
      where a.status='open' and p.status='active' and p.adult_confirmed and p.cloud_sync and (p_cursor is null or a.sequence_id<p_cursor)
      order by a.sequence_id desc limit p_limit) page;
  return jsonb_build_object('items',result,'nextCursor',case when n=p_limit then last_id::text else null end);
end $$;

create function public.hl_propose_appeal(p_appeal_id uuid,p_revision integer,p_reason text,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_review_role('operator'); a public.appeals; p public.profiles; existing private.appeal_adjustments;
  candidate public.activity_submissions; proposal private.appeal_adjustments; cutoff_day date;
begin
  if p_appeal_id is null or p_revision is null or p_revision<1 or p_idempotency_key is null or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then
    raise exception using errcode='P0001',message='INVALID_INPUT';
  end if;
  select * into a from public.appeals where id=p_appeal_id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  p:=private.lock_review_accounts(a.user_id,'operator');
  select * into a from public.appeals where id=p_appeal_id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select * into existing from private.appeal_adjustments where proposer_id=actor and proposal_key=p_idempotency_key;
  if found then
    if existing.appeal_id<>p_appeal_id or existing.revision<>p_revision or existing.proposal_reason<>trim(p_reason) then
      raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('id',existing.id,'appealId',existing.appeal_id,'revision',existing.revision,'status','pending','createdAt',existing.created_at);
  end if;
  if a.status<>'open' then raise exception using errcode='P0001',message='APPEAL_CLOSED'; end if;
  select (private.server_now() at time zone 'Asia/Hong_Kong')::date-summary_retention_days into cutoff_day from private.system_settings where singleton;
  -- A complete dependent week must still be retained; partial pruned weeks cannot
  -- supply reliable evidence for revoking an existing weekly bonus.
  if private.week_start(a.task_date)<cutoff_day then raise exception using errcode='P0001',message='SUBMISSION_NOT_REVIEWABLE'; end if;
  select s.* into candidate from public.activity_submissions s join public.risk_flags r using(user_id,task_date,revision)
    where s.user_id=p.id and s.task_date=a.task_date and s.revision=p_revision and s.outcome->>'status'='pending_review' and r.status='pending';
  if not found or exists(select 1 from public.activity_submissions where user_id=p.id and task_date=a.task_date and revision>p_revision)
    or exists(select 1 from public.daily_activity_summaries where user_id=p.id and task_date=a.task_date and revision>=p_revision) then
    raise exception using errcode='P0001',message='SUBMISSION_NOT_REVIEWABLE';
  end if;
  perform private.rate_limit(actor,'propose_appeal',20);
  insert into private.appeal_adjustments(appeal_id,user_id,task_date,revision,proposer_id,proposal_key,proposal_reason,baseline)
    values(a.id,p.id,a.task_date,p_revision,actor,p_idempotency_key,trim(p_reason),private.review_baseline(p.id,a.task_date)) returning * into proposal;
  insert into private.admin_audit(actor_id,action,reason,adjustment_id,reason_digest)
    values(actor,'propose_appeal','Appeal adjustment proposed',proposal.id,encode(sha256(convert_to(trim(p_reason),'UTF8')),'hex'));
  return jsonb_build_object('id',proposal.id,'appealId',a.id,'revision',p_revision,'status','pending','createdAt',proposal.created_at);
end $$;

create function public.hl_decide_appeal(p_proposal_id uuid,p_decision text,p_reason text,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_review_role('reviewer'); q private.appeal_adjustments; other private.appeal_adjustments;
  p public.profiles; a public.appeals; s public.activity_submissions; d public.mission_instances; w public.mission_instances;
  v public.mission_versions; daily_total integer; weekly_total integer; daily_delta integer:=0; weekly_delta integer:=0;
  days integer; related bigint; t timestamptz; cutoff_day date; result jsonb;
begin
  if p_proposal_id is null or p_idempotency_key is null or p_decision is null or p_decision not in ('approve','reject')
    or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  select * into q from private.appeal_adjustments where id=p_proposal_id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  if actor=q.proposer_id or actor=q.user_id then raise exception using errcode='P0001',message='SELF_REVIEW'; end if;
  p:=private.lock_review_accounts(q.user_id,'reviewer');
  select * into q from private.appeal_adjustments where id=p_proposal_id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select * into other from private.appeal_adjustments where reviewer_id=actor and decision_key=p_idempotency_key;
  if found then
    if other.id<>q.id or other.decision<>p_decision or other.decision_reason<>trim(p_reason) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return other.decision_outcome;
  end if;
  if q.status<>'pending' then raise exception using errcode='P0001',message='PROPOSAL_DECIDED'; end if;
  t:=private.server_now();
  if p_decision='approve' then
    -- Conservative incident policy: all approvals pause, including negative ones.
    -- Proposing/rejecting and reading history remain available during a pause.
    perform 1 from private.system_settings where singleton and not rewards_paused for share;
    if not found then raise exception using errcode='P0001',message='REWARDS_PAUSED'; end if;
    select (t at time zone 'Asia/Hong_Kong')::date-summary_retention_days into cutoff_day from private.system_settings where singleton;
    if private.week_start(q.task_date)<cutoff_day then raise exception using errcode='P0001',message='SUBMISSION_NOT_REVIEWABLE'; end if;
    select * into a from public.appeals where id=q.appeal_id;
    if a.status<>'open' then raise exception using errcode='P0001',message='APPEAL_CLOSED'; end if;
    if q.baseline<>private.review_baseline(p.id,q.task_date) then raise exception using errcode='P0001',message='STALE_PROPOSAL'; end if;
    select submission.* into s from public.activity_submissions submission join public.risk_flags r using(user_id,task_date,revision)
      where submission.user_id=p.id and submission.task_date=q.task_date and submission.revision=q.revision and submission.outcome->>'status'='pending_review' and r.status='pending';
    if not found then raise exception using errcode='P0001',message='SUBMISSION_NOT_REVIEWABLE'; end if;
    select * into d from public.mission_instances where user_id=p.id and kind='daily_steps' and period_start=q.task_date;
    select * into w from public.mission_instances where user_id=p.id and kind='weekly_consistency' and period_start=private.week_start(q.task_date);
    if d.id is null or w.id is null then raise exception using errcode='P0001',message='SUBMISSION_NOT_REVIEWABLE'; end if;
    if d.source_category is not null and (d.source_category<>s.payload->>'sourceCategory' or d.source_policy<>s.payload->>'sourcePolicy' or d.source_pin_token<>(s.payload->>'sourcePinToken')::uuid) then
      raise exception using errcode='P0001',message='SOURCE_PINNED';
    end if;
    insert into public.daily_activity_summaries(user_id,task_date,eligible_steps,source_category,source_policy,source_pin_token,revision,observed_at,timezone,received_at)
      values(p.id,q.task_date,(s.payload->>'eligibleSteps')::integer,s.payload->>'sourceCategory',s.payload->>'sourcePolicy',(s.payload->>'sourcePinToken')::uuid,q.revision,(s.payload->>'observedAt')::timestamptz,s.payload->>'timezone',t)
      on conflict(user_id,task_date) do update set eligible_steps=excluded.eligible_steps,source_category=excluded.source_category,source_policy=excluded.source_policy,
        source_pin_token=excluded.source_pin_token,revision=excluded.revision,observed_at=excluded.observed_at,timezone=excluded.timezone,received_at=excluded.received_at;
    select coalesce(max((tier->>'points')::integer),0) into daily_total from public.mission_versions rules,
      lateral jsonb_array_elements(rules.tiers) tier where rules.version=d.rule_version and (tier->>'steps')::integer<=(s.payload->>'eligibleSteps')::integer;
    select * into v from public.mission_versions where version=w.rule_version;
    select count(*) into days from public.daily_activity_summaries where user_id=p.id and task_date between w.period_start and w.period_start+6 and eligible_steps>=w.selected_goal;
    weekly_total:=case when days>=v.weekly_days then v.weekly_points else 0 end;
    daily_delta:=daily_total-d.awarded_points; weekly_delta:=weekly_total-w.awarded_points;
    if daily_delta<>0 then
      select id into related from public.point_ledger where account_key=p.account_key and instance_id=d.id order by id desc limit 1;
      insert into public.point_ledger(account_key,kind,points,instance_id,entitlement_total,posting_epoch,adjustment_id,related_entry_id)
        values(p.account_key,'daily_correction',daily_delta,d.id,daily_total,d.posting_epoch+1,q.id,related);
    end if;
    if weekly_delta<>0 then
      select id into related from public.point_ledger where account_key=p.account_key and instance_id=w.id order by id desc limit 1;
      insert into public.point_ledger(account_key,kind,points,instance_id,entitlement_total,posting_epoch,adjustment_id,related_entry_id)
        values(p.account_key,'weekly_correction',weekly_delta,w.id,weekly_total,w.posting_epoch+1,q.id,related);
    end if;
    update public.mission_instances set awarded_points=daily_total,posting_epoch=posting_epoch+1,source_category=s.payload->>'sourceCategory',
      source_policy=s.payload->>'sourcePolicy',source_pin_token=(s.payload->>'sourcePinToken')::uuid where id=d.id;
    update public.mission_instances set awarded_points=weekly_total,posting_epoch=posting_epoch+1 where id=w.id;
    -- The approved latest revision supersedes older pending evidence for that day.
    update public.risk_flags set status='resolved' where user_id=p.id and task_date=q.task_date and revision<=q.revision;
    update public.appeals set status='resolved' where id=q.appeal_id;
  end if;
  perform private.rate_limit(actor,'decide_appeal',40);
  result:=jsonb_build_object('id',q.id,'appealId',q.appeal_id,'status',case when p_decision='approve' then 'approved' else 'rejected' end,
    'decision',p_decision,'addedPoints',daily_delta+weekly_delta,'dailyDelta',daily_delta,'weeklyDelta',weekly_delta,
    'balance',private.balance(p.account_key),'availablePoints',greatest(private.balance(p.account_key),0),'decidedAt',t);
  update private.appeal_adjustments set status=case when p_decision='approve' then 'approved' else 'rejected' end,reviewer_id=actor,
    decision_key=p_idempotency_key,decision=p_decision,decision_reason=trim(p_reason),decision_outcome=result,decided_at=t where id=q.id;
  insert into private.admin_audit(actor_id,action,reason,adjustment_id,reason_digest)
    values(actor,case when p_decision='approve' then 'approve_appeal' else 'reject_appeal' end,'Appeal adjustment reviewed',q.id,encode(sha256(convert_to(trim(p_reason),'UTF8')),'hex'));
  return result;
end $$;

-- Existing public RPCs retain their grants and original receipt semantics.
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
    insert into public.point_ledger(account_key,kind,points,instance_id,entitlement_total,posting_epoch) values(p.account_key,'daily_award',delta,m.id,total,m.posting_epoch);
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
    insert into public.point_ledger(account_key,kind,points,instance_id,entitlement_total,posting_epoch) values(p.account_key,'weekly_award',bonus,w.id,bonus,w.posting_epoch);
    update public.mission_instances set awarded_points=bonus where id=w.id;
  end if;
  outcome:=jsonb_build_object('instanceId',m.id,'addedPoints',delta+bonus,'dailyAwardedPoints',case when m.kind='daily_steps' then greatest(total,m.awarded_points) else 0 end,
    'weeklyAwardedPoints',w.awarded_points+bonus,'balance',private.balance(p.account_key));
  insert into public.claim_requests(user_id,idempotency_key,instance_id,outcome) values(p.id,p_idempotency_key,m.id,outcome);
  return outcome;
end $$;


create or replace function public.hl_points_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; result jsonb;
begin
  p:=private.lock_account(false);
  select jsonb_build_object('balance',coalesce(sum(points),0),'correctionPoints',coalesce(sum(points) filter(where kind in ('daily_correction','weekly_correction')),0),'availablePoints',greatest(coalesce(sum(points),0),0),'earnedPoints',coalesce(sum(points) filter(where kind in ('daily_award','weekly_award')),0),
    'spentPoints',-coalesce(sum(points) filter(where kind='redemption'),0),'reversedPoints',coalesce(sum(points) filter(where kind='refund'),0),
    'pendingEvaluations',(select count(*) from public.risk_flags where user_id=p.id and status='pending')) into result
  from public.point_ledger where account_key=p.account_key;
  return result;
end $$;
create or replace function public.hl_ledger(p_limit integer default 20,p_cursor bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; result jsonb; n integer; last_id bigint;
begin
  p:=private.lock_account(false);
  if p_limit is null or p_limit not between 1 and 100 or (p_cursor is not null and p_cursor<=0) then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'kind',kind,'points',points,'createdAt',created_at,'instanceId',instance_id,'adjustmentId',adjustment_id,'relatedEntryId',related_entry_id::text) order by id desc),'[]'::jsonb),count(*),min(id)
    into result,n,last_id from (select * from public.point_ledger where account_key=p.account_key and (p_cursor is null or id<p_cursor) order by id desc limit p_limit) page;
  return jsonb_build_object('items',result,'nextCursor',case when n=p_limit then last_id::text else null end);
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
create or replace function public.hl_export() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
  p:=private.lock_account(false); perform private.rate_limit(p.id,'export',2);
  return jsonb_build_object('exportedAt',private.server_now(),'profile',private.profile_json(p),
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

create or replace function public.hl_prune_summaries() returns bigint language plpgsql security definer set search_path='' as $$
declare cutoff_day date; subject uuid; n bigint:=0; removed bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='P0001',message='FORBIDDEN'; end if;
  select (private.server_now() at time zone 'Asia/Hong_Kong')::date-summary_retention_days into cutoff_day from private.system_settings where singleton;
  -- Ordered profile locks also serialize retention with corrections and deletion.
  for subject in select p.id from public.profiles p where
    exists(select 1 from public.daily_activity_summaries s where s.user_id=p.id and s.task_date<cutoff_day)
    or exists(select 1 from public.activity_submissions s where s.user_id=p.id and s.task_date<cutoff_day)
    or exists(select 1 from public.appeals a where a.user_id=p.id and a.task_date<cutoff_day)
    or exists(select 1 from private.appeal_adjustments a where a.user_id=p.id and private.week_start(a.task_date)<cutoff_day)
    order by p.id for update of p loop
    -- Snapshots contain the whole dependent week; expire them when its earliest
    -- day leaves retention, even if the appeal's own task day is still retained.
    delete from private.appeal_adjustments where user_id=subject and private.week_start(task_date)<cutoff_day;
    delete from public.appeals where user_id=subject and task_date<cutoff_day;
    delete from public.risk_flags where user_id=subject and task_date<cutoff_day;
    delete from public.daily_activity_summaries where user_id=subject and task_date<cutoff_day;
    get diagnostics removed=row_count; n:=n+removed;
    delete from public.activity_submissions where user_id=subject and task_date<cutoff_day;
  end loop;
  return n;
end $$;

revoke execute on function private.protect_adjustment(),private.require_review_role(text),private.lock_review_accounts(uuid,text),
  private.review_baseline(uuid,date),private.proposal_json(private.appeal_adjustments),private.appeal_json(public.appeals) from public,anon,authenticated;
revoke execute on function public.hl_appeals(integer,bigint),public.hl_admin_appeals(integer,bigint),
  public.hl_propose_appeal(uuid,integer,text,uuid),public.hl_decide_appeal(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.hl_appeals(integer,bigint),public.hl_admin_appeals(integer,bigint),
  public.hl_propose_appeal(uuid,integer,text,uuid),public.hl_decide_appeal(uuid,text,text,uuid) to authenticated;
