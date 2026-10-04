alter table tactics.battles
  add column if not exists realtime_key uuid not null default gen_random_uuid();

create unique index if not exists battles_realtime_key_key
  on tactics.battles (realtime_key);

create table if not exists tactics.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references tactics.battles(id) on delete cascade,
  access_key uuid not null unique default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  role text not null check (role in ('host', 'player', 'spectator')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (battle_id, id)
);

create unique index if not exists battle_participants_one_host
  on tactics.battle_participants (battle_id)
  where role = 'host';

create table if not exists tactics.battle_unit_controllers (
  battle_id uuid not null,
  unit_id text not null,
  participant_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (battle_id, unit_id),
  foreign key (battle_id, unit_id)
    references tactics.battle_units(battle_id, unit_id)
    on delete cascade,
  foreign key (battle_id, participant_id)
    references tactics.battle_participants(battle_id, id)
    on delete cascade
);

alter table tactics.battle_participants enable row level security;
alter table tactics.battle_unit_controllers enable row level security;

revoke all on table tactics.battle_participants from public, anon, authenticated;
revoke all on table tactics.battle_unit_controllers from public, anon, authenticated;

create or replace function public.tactics_create_host_session(
  _write_key uuid,
  _display_name text default 'DM'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle tactics.battles%rowtype;
  v_participant tactics.battle_participants%rowtype;
begin
  if nullif(btrim(_display_name), '') is null then
    raise exception 'display name is required';
  end if;

  select * into v_battle
  from tactics.battles
  where write_key = _write_key
  for update;

  if not found then
    raise exception 'battle write key is invalid' using errcode = '42501';
  end if;

  select * into v_participant
  from tactics.battle_participants
  where battle_id = v_battle.id
    and role = 'host'
  limit 1;

  if not found then
    insert into tactics.battle_participants (battle_id, display_name, role)
    values (v_battle.id, btrim(_display_name), 'host')
    returning * into v_participant;
  else
    update tactics.battle_participants
    set display_name = btrim(_display_name),
        last_seen_at = now()
    where id = v_participant.id
    returning * into v_participant;
  end if;

  return jsonb_build_object(
    'battleId', v_battle.id,
    'participantId', v_participant.id,
    'participantKey', v_participant.access_key,
    'displayName', v_participant.display_name,
    'role', v_participant.role,
    'realtimeTopic', v_battle.realtime_key::text
  );
end;
$$;

create or replace function public.tactics_create_player_session(
  _host_key uuid,
  _display_name text,
  _unit_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host tactics.battle_participants%rowtype;
  v_battle tactics.battles%rowtype;
  v_player tactics.battle_participants%rowtype;
  v_requested_count integer;
  v_found_count integer;
begin
  if nullif(btrim(_display_name), '') is null then
    raise exception 'display name is required';
  end if;

  v_requested_count := coalesce(cardinality(_unit_ids), 0);
  if v_requested_count = 0 then
    raise exception 'at least one controlled unit is required';
  end if;

  select * into v_host
  from tactics.battle_participants
  where access_key = _host_key
    and role = 'host';

  if not found then
    raise exception 'host participant key is invalid' using errcode = '42501';
  end if;

  select * into v_battle
  from tactics.battles
  where id = v_host.battle_id
  for update;

  select count(distinct bu.unit_id) into v_found_count
  from tactics.battle_units bu
  where bu.battle_id = v_battle.id
    and bu.unit_id = any(_unit_ids);

  if v_found_count <> (select count(distinct value) from unnest(_unit_ids) as requested(value)) then
    raise exception 'one or more requested battle units do not exist';
  end if;

  insert into tactics.battle_participants (battle_id, display_name, role)
  values (v_battle.id, btrim(_display_name), 'player')
  returning * into v_player;

  insert into tactics.battle_unit_controllers (battle_id, unit_id, participant_id)
  select v_battle.id, requested.value, v_player.id
  from (select distinct unnest(_unit_ids) as value) requested
  on conflict (battle_id, unit_id)
  do update set participant_id = excluded.participant_id,
                created_at = now();

  update tactics.battle_participants
  set last_seen_at = now()
  where id = v_host.id;

  return jsonb_build_object(
    'battleId', v_battle.id,
    'participantId', v_player.id,
    'participantKey', v_player.access_key,
    'displayName', v_player.display_name,
    'role', v_player.role,
    'controlledUnitIds', to_jsonb(_unit_ids),
    'realtimeTopic', v_battle.realtime_key::text
  );
end;
$$;

create or replace function public.tactics_get_multiplayer_battle(
  _participant_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant tactics.battle_participants%rowtype;
  v_battle tactics.battles%rowtype;
  v_state jsonb;
  v_events jsonb;
  v_saved_at timestamptz;
  v_controlled_units jsonb;
begin
  select * into v_participant
  from tactics.battle_participants
  where access_key = _participant_key;

  if not found then
    return null;
  end if;

  select * into v_battle
  from tactics.battles
  where id = v_participant.battle_id;

  select s.state, s.created_at
  into v_state, v_saved_at
  from tactics.battle_snapshots s
  where s.battle_id = v_battle.id
  order by s.version desc
  limit 1;

  select coalesce(jsonb_agg(e.event order by e.sequence), '[]'::jsonb)
  into v_events
  from tactics.battle_events e
  where e.battle_id = v_battle.id;

  v_state := jsonb_set(v_state, '{events}', v_events, true);

  select coalesce(jsonb_agg(c.unit_id order by c.unit_id), '[]'::jsonb)
  into v_controlled_units
  from tactics.battle_unit_controllers c
  where c.battle_id = v_battle.id
    and c.participant_id = v_participant.id;

  update tactics.battle_participants
  set last_seen_at = now()
  where id = v_participant.id;

  return jsonb_build_object(
    'id', v_battle.id,
    'name', v_battle.name,
    'status', v_battle.status,
    'version', v_battle.version,
    'latestEventSequence', v_battle.latest_event_sequence,
    'state', v_state,
    'savedAt', v_saved_at,
    'participant', jsonb_build_object(
      'id', v_participant.id,
      'displayName', v_participant.display_name,
      'role', v_participant.role,
      'controlledUnitIds', v_controlled_units
    ),
    'realtimeTopic', v_battle.realtime_key::text
  );
end;
$$;

create or replace function public.tactics_commit_multiplayer_battle(
  _participant_key uuid,
  _expected_version bigint,
  _state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant tactics.battle_participants%rowtype;
  v_battle tactics.battles%rowtype;
  v_current_state jsonb;
  v_active_index integer;
  v_active_unit_id text;
  v_commit jsonb;
begin
  select * into v_participant
  from tactics.battle_participants
  where access_key = _participant_key;

  if not found then
    raise exception 'participant key is invalid' using errcode = '42501';
  end if;

  if v_participant.role = 'spectator' then
    raise exception 'spectators cannot change battle state' using errcode = '42501';
  end if;

  select * into v_battle
  from tactics.battles
  where id = v_participant.battle_id
  for update;

  select s.state into v_current_state
  from tactics.battle_snapshots s
  where s.battle_id = v_battle.id
  order by s.version desc
  limit 1;

  if v_participant.role = 'player' then
    v_active_index := coalesce((v_current_state #>> '{turn,activeIndex}')::integer, 0);
    v_active_unit_id := (v_current_state #> '{turn,order}') ->> v_active_index;

    if v_active_unit_id is null
       or not exists (
         select 1
         from tactics.battle_unit_controllers c
         where c.battle_id = v_battle.id
           and c.participant_id = v_participant.id
           and c.unit_id = v_active_unit_id
       ) then
      raise exception 'participant does not control the active unit' using errcode = '42501';
    end if;
  end if;

  select public.tactics_commit_battle(v_battle.write_key, _expected_version, _state)
  into v_commit;

  update tactics.battle_participants
  set last_seen_at = now()
  where id = v_participant.id;

  return jsonb_build_object(
    'id', v_battle.id,
    'version', (v_commit->>'version')::bigint,
    'latestEventSequence', (v_commit->>'latestEventSequence')::bigint,
    'realtimeTopic', v_battle.realtime_key::text
  );
end;
$$;

revoke all on function public.tactics_create_host_session(uuid, text) from public;
revoke all on function public.tactics_create_player_session(uuid, text, text[]) from public;
revoke all on function public.tactics_get_multiplayer_battle(uuid) from public;
revoke all on function public.tactics_commit_multiplayer_battle(uuid, bigint, jsonb) from public;

grant execute on function public.tactics_create_host_session(uuid, text) to anon, authenticated, service_role;
grant execute on function public.tactics_create_player_session(uuid, text, text[]) to anon, authenticated, service_role;
grant execute on function public.tactics_get_multiplayer_battle(uuid) to anon, authenticated, service_role;
grant execute on function public.tactics_commit_multiplayer_battle(uuid, bigint, jsonb) to anon, authenticated, service_role;
