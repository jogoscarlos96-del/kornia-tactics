create schema if not exists tactics;

revoke all on schema tactics from public, anon, authenticated;

grant usage on schema tactics to service_role;

create table tactics.battles (
  id uuid primary key default gen_random_uuid(),
  read_key uuid not null unique default gen_random_uuid(),
  write_key uuid not null unique default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  version bigint not null default 1 check (version >= 1),
  latest_event_sequence bigint not null default 0 check (latest_event_sequence >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tactics.battle_units (
  battle_id uuid not null references tactics.battles(id) on delete cascade,
  unit_id text not null,
  source_kind text not null default 'generated' check (source_kind in ('generated', 'owned_pokemon')),
  source_pokemon_id integer references private.pokemon(id) on delete set null,
  source_move_bindings jsonb not null default '{}'::jsonb check (jsonb_typeof(source_move_bindings) = 'object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  primary key (battle_id, unit_id)
);

create table tactics.battle_events (
  battle_id uuid not null references tactics.battles(id) on delete cascade,
  sequence bigint not null check (sequence >= 1),
  event jsonb not null check (jsonb_typeof(event) = 'object'),
  created_at timestamptz not null default now(),
  primary key (battle_id, sequence)
);

create table tactics.battle_snapshots (
  id bigint generated always as identity primary key,
  battle_id uuid not null references tactics.battles(id) on delete cascade,
  version bigint not null check (version >= 1),
  event_sequence bigint not null check (event_sequence >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  unique (battle_id, version)
);

create index battle_events_battle_created_idx on tactics.battle_events (battle_id, created_at);
create index battle_snapshots_battle_created_idx on tactics.battle_snapshots (battle_id, created_at desc);
create index battle_units_source_pokemon_idx on tactics.battle_units (source_pokemon_id) where source_pokemon_id is not null;

alter table tactics.battles enable row level security;
alter table tactics.battle_units enable row level security;
alter table tactics.battle_events enable row level security;
alter table tactics.battle_snapshots enable row level security;

revoke all on all tables in schema tactics from public, anon, authenticated;
revoke all on all sequences in schema tactics from public, anon, authenticated;

grant all on all tables in schema tactics to service_role;
grant all on all sequences in schema tactics to service_role;

create or replace function tactics.apply_canonical_resources(_battle_id uuid, _state jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_binding record;
  v_state_unit jsonb;
  v_hp integer;
  v_move_binding record;
  v_pp integer;
begin
  for v_binding in
    select bu.unit_id, bu.source_pokemon_id, bu.source_move_bindings
    from tactics.battle_units bu
    where bu.battle_id = _battle_id
      and bu.source_kind = 'owned_pokemon'
      and bu.source_pokemon_id is not null
  loop
    select unit_value.value
    into v_state_unit
    from jsonb_array_elements(_state->'units') as unit_value(value)
    where unit_value.value->>'unitId' = v_binding.unit_id
    limit 1;

    if v_state_unit is null then
      raise exception 'bound unit % is missing from battle state', v_binding.unit_id;
    end if;

    v_hp := (v_state_unit->>'currentHp')::integer;
    update private.pokemon
    set hp_cur = least(hp_max, greatest(0, v_hp))
    where id = v_binding.source_pokemon_id;

    for v_move_binding in
      select key as move_id, value as canonical_move_row_id
      from jsonb_each_text(v_binding.source_move_bindings)
    loop
      select (move_value.value->>'ppCurrent')::integer
      into v_pp
      from jsonb_array_elements(v_state_unit->'moves') as move_value(value)
      where move_value.value->>'id' = v_move_binding.move_id
      limit 1;

      if v_pp is not null then
        update private.moves
        set pp_cur = least(pp_max, greatest(0, v_pp))
        where id = v_move_binding.canonical_move_row_id::bigint
          and pokemon_id = v_binding.source_pokemon_id;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.tactics_create_battle(_name text, _state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle_id uuid := gen_random_uuid();
  v_read_key uuid := gen_random_uuid();
  v_write_key uuid := gen_random_uuid();
  v_event_count bigint;
  v_event_max bigint;
  v_event_min bigint;
  v_event_distinct bigint;
begin
  if nullif(btrim(_name), '') is null then
    raise exception 'battle name is required';
  end if;

  if jsonb_typeof(_state) <> 'object'
     or jsonb_typeof(_state->'battle') <> 'object'
     or jsonb_typeof(_state->'units') <> 'array'
     or jsonb_typeof(_state->'turn') <> 'object'
     or jsonb_typeof(_state->'events') <> 'array' then
    raise exception 'invalid combat state';
  end if;

  if jsonb_array_length(_state->'units') = 0 then
    raise exception 'battle requires at least one combat unit';
  end if;

  select count(*),
         coalesce(max((event_value.value->>'sequence')::bigint), 0),
         coalesce(min((event_value.value->>'sequence')::bigint), 0),
         count(distinct (event_value.value->>'sequence')::bigint)
  into v_event_count, v_event_max, v_event_min, v_event_distinct
  from jsonb_array_elements(_state->'events') as event_value(value);

  if v_event_count > 0 and (v_event_min <> 1 or v_event_max <> v_event_count or v_event_distinct <> v_event_count) then
    raise exception 'battle events must use contiguous unique sequences starting at 1';
  end if;

  insert into tactics.battles (id, read_key, write_key, name, version, latest_event_sequence)
  values (v_battle_id, v_read_key, v_write_key, btrim(_name), 1, v_event_max);

  insert into tactics.battle_units (battle_id, unit_id, snapshot)
  select v_battle_id,
         combat_unit.value->>'unitId',
         jsonb_build_object(
           'combat', combat_unit.value,
           'view', coalesce((
             select battle_unit.value
             from jsonb_array_elements(_state #> '{battle,units}') as battle_unit(value)
             where battle_unit.value->>'id' = combat_unit.value->>'unitId'
             limit 1
           ), '{}'::jsonb)
         )
  from jsonb_array_elements(_state->'units') as combat_unit(value);

  insert into tactics.battle_events (battle_id, sequence, event)
  select v_battle_id,
         (event_value.value->>'sequence')::bigint,
         event_value.value
  from jsonb_array_elements(_state->'events') as event_value(value)
  order by (event_value.value->>'sequence')::bigint;

  insert into tactics.battle_snapshots (battle_id, version, event_sequence, state)
  values (v_battle_id, 1, v_event_max, _state);

  return jsonb_build_object(
    'id', v_battle_id,
    'readKey', v_read_key,
    'writeKey', v_write_key,
    'version', 1,
    'latestEventSequence', v_event_max
  );
end;
$$;

create or replace function public.tactics_get_battle(_read_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle tactics.battles%rowtype;
  v_state jsonb;
  v_events jsonb;
  v_saved_at timestamptz;
begin
  select * into v_battle
  from tactics.battles
  where read_key = _read_key;

  if not found then
    return null;
  end if;

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

  return jsonb_build_object(
    'id', v_battle.id,
    'name', v_battle.name,
    'status', v_battle.status,
    'version', v_battle.version,
    'latestEventSequence', v_battle.latest_event_sequence,
    'state', v_state,
    'savedAt', v_saved_at
  );
end;
$$;

create or replace function public.tactics_commit_battle(_write_key uuid, _expected_version bigint, _state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle tactics.battles%rowtype;
  v_event_count bigint;
  v_event_max bigint;
  v_event_min bigint;
  v_event_distinct bigint;
  v_unit_count bigint;
  v_state_unit_count bigint;
  v_next_version bigint;
begin
  select * into v_battle
  from tactics.battles
  where write_key = _write_key
  for update;

  if not found then
    raise exception 'battle write key is invalid' using errcode = '42501';
  end if;

  if v_battle.version <> _expected_version then
    raise exception 'version conflict: expected %, current %', _expected_version, v_battle.version using errcode = '40001';
  end if;

  if jsonb_typeof(_state) <> 'object'
     or jsonb_typeof(_state->'battle') <> 'object'
     or jsonb_typeof(_state->'units') <> 'array'
     or jsonb_typeof(_state->'turn') <> 'object'
     or jsonb_typeof(_state->'events') <> 'array' then
    raise exception 'invalid combat state';
  end if;

  select count(*) into v_unit_count
  from tactics.battle_units
  where battle_id = v_battle.id;

  v_state_unit_count := jsonb_array_length(_state->'units');

  if v_unit_count <> v_state_unit_count
     or exists (
       select 1
       from tactics.battle_units bu
       where bu.battle_id = v_battle.id
         and not exists (
           select 1
           from jsonb_array_elements(_state->'units') as state_unit(value)
           where state_unit.value->>'unitId' = bu.unit_id
         )
     ) then
    raise exception 'battle unit set cannot change during Phase 5 persistence';
  end if;

  select count(*),
         coalesce(max((event_value.value->>'sequence')::bigint), 0),
         coalesce(min((event_value.value->>'sequence')::bigint), 0),
         count(distinct (event_value.value->>'sequence')::bigint)
  into v_event_count, v_event_max, v_event_min, v_event_distinct
  from jsonb_array_elements(_state->'events') as event_value(value);

  if v_event_count > 0 and (v_event_min <> 1 or v_event_max <> v_event_count or v_event_distinct <> v_event_count) then
    raise exception 'battle events must use contiguous unique sequences starting at 1';
  end if;

  if v_event_max < v_battle.latest_event_sequence then
    raise exception 'battle events cannot be removed';
  end if;

  if exists (
    select 1
    from tactics.battle_events existing_event
    left join jsonb_array_elements(_state->'events') as incoming_event(value)
      on (incoming_event.value->>'sequence')::bigint = existing_event.sequence
    where existing_event.battle_id = v_battle.id
      and (incoming_event.value is null or incoming_event.value <> existing_event.event)
  ) then
    raise exception 'persisted battle events are immutable';
  end if;

  insert into tactics.battle_events (battle_id, sequence, event)
  select v_battle.id,
         (event_value.value->>'sequence')::bigint,
         event_value.value
  from jsonb_array_elements(_state->'events') as event_value(value)
  where (event_value.value->>'sequence')::bigint > v_battle.latest_event_sequence
  order by (event_value.value->>'sequence')::bigint;

  perform tactics.apply_canonical_resources(v_battle.id, _state);

  v_next_version := v_battle.version + 1;

  update tactics.battles
  set version = v_next_version,
      latest_event_sequence = v_event_max,
      updated_at = now()
  where id = v_battle.id;

  insert into tactics.battle_snapshots (battle_id, version, event_sequence, state)
  values (v_battle.id, v_next_version, v_event_max, _state);

  return jsonb_build_object(
    'id', v_battle.id,
    'readKey', v_battle.read_key,
    'version', v_next_version,
    'latestEventSequence', v_event_max
  );
end;
$$;

create or replace function public.tactics_bind_owned_pokemon(
  _write_key uuid,
  _unit_id text,
  _pokemon_id integer,
  _trainer_write_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle_id uuid;
  v_species text;
  v_expected_species text;
  v_move_bindings jsonb;
begin
  select b.id into v_battle_id
  from tactics.battles b
  where b.write_key = _write_key
  for update;

  if v_battle_id is null then
    raise exception 'battle write key is invalid' using errcode = '42501';
  end if;

  select p.species into v_species
  from private.pokemon p
  join private.trainers t on t.id = p.trainer_id
  where p.id = _pokemon_id
    and t.write_key = _trainer_write_key;

  if v_species is null then
    raise exception 'trainer write key does not authorize this Pokemon' using errcode = '42501';
  end if;

  select bu.snapshot #>> '{view,species,id}'
  into v_expected_species
  from tactics.battle_units bu
  where bu.battle_id = v_battle_id
    and bu.unit_id = _unit_id;

  if not found then
    raise exception 'battle unit not found';
  end if;

  if v_expected_species is null or v_expected_species <> v_species then
    raise exception 'owned Pokemon species % does not match battle unit species %', v_species, coalesce(v_expected_species, '<missing>');
  end if;

  select coalesce(jsonb_object_agg(m.move_id, to_jsonb(m.id)), '{}'::jsonb)
  into v_move_bindings
  from private.moves m
  where m.pokemon_id = _pokemon_id;

  update tactics.battle_units
  set source_kind = 'owned_pokemon',
      source_pokemon_id = _pokemon_id,
      source_move_bindings = v_move_bindings
  where battle_id = v_battle_id
    and unit_id = _unit_id;

  return jsonb_build_object(
    'battleId', v_battle_id,
    'unitId', _unit_id,
    'sourcePokemonId', _pokemon_id,
    'moveBindings', v_move_bindings
  );
end;
$$;

revoke all on function public.tactics_create_battle(text, jsonb) from public;
revoke all on function public.tactics_get_battle(uuid) from public;
revoke all on function public.tactics_commit_battle(uuid, bigint, jsonb) from public;
revoke all on function public.tactics_bind_owned_pokemon(uuid, text, integer, text) from public;

grant execute on function public.tactics_create_battle(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.tactics_get_battle(uuid) to anon, authenticated, service_role;
grant execute on function public.tactics_commit_battle(uuid, bigint, jsonb) to anon, authenticated, service_role;
grant execute on function public.tactics_bind_owned_pokemon(uuid, text, integer, text) to anon, authenticated, service_role;
