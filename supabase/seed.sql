-- LOCAL SYNTHETIC DATA ONLY. Do not apply this seed to a remote project.
-- CLI project_id is healthloop-local-dev. It contains no users or health samples.
update private.system_settings set demo_mode=true,project_label='healthloop-local-dev' where singleton;
insert into public.reward_catalog(id,title_key,points_cost,stock,is_demo)
values ('47d2e940-06c8-4f1e-824c-8e8e9b02568a','rewards.demoBadge',20,100,true)
on conflict(id) do nothing;
