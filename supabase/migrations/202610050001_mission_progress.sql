-- Progress is derived under the same account lock and weekly qualification rule
-- as claims. Reading progress never posts points or changes historical rules.
create or replace function public.hl_missions() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; t timestamptz; today date; result jsonb;
begin
  p:=private.lock_account(false);
  t:=private.server_now();
  today:=(t at time zone 'Asia/Hong_Kong')::date;
  perform private.ensure_mission(p.id,'daily_steps',today);
  perform private.ensure_mission(p.id,'weekly_consistency',private.week_start(today));
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'kind',m.kind,'periodStart',m.period_start,'ruleVersion',m.rule_version,
    'selectedGoal',m.selected_goal,'awardedPoints',m.awarded_points,'eligibleSteps',s.eligible_steps,
    'cutoffAt',private.cutoff(case when m.kind='daily_steps' then m.period_start else m.period_start+6 end,v.late_cutoff),
    'tiers',v.tiers,'weeklyDaysRequired',v.weekly_days,'weeklyBonusPoints',v.weekly_points,
    'qualifyingDates',case when m.kind='daily_steps' then '[]'::jsonb else (
      select coalesce(jsonb_agg(d.task_date order by d.task_date),'[]'::jsonb)
      from public.daily_activity_summaries d join public.mission_instances i
        on i.user_id=d.user_id and i.period_start=d.task_date and i.kind='daily_steps'
      where d.user_id=p.id and d.task_date between m.period_start and m.period_start+6 and d.eligible_steps>=m.selected_goal
    ) end,
    'pendingReview',exists(select 1 from public.risk_flags r where r.user_id=p.id and r.status='pending'
      and r.task_date between m.period_start and case when m.kind='daily_steps' then m.period_start else m.period_start+6 end)
  ) order by m.period_start desc,m.kind),'[]'::jsonb)
  into result from public.mission_instances m join public.mission_versions v on v.version=m.rule_version
  left join public.daily_activity_summaries s on s.user_id=p.id and s.task_date=m.period_start and m.kind='daily_steps'
  where m.user_id=p.id and m.period_start between today-7 and today;
  return jsonb_build_object('serverNow',t,'taskDate',today,'timezone','Asia/Hong_Kong','items',result);
end $$;
revoke all on function public.hl_missions() from public,anon;
grant execute on function public.hl_missions() to authenticated;
