create index if not exists battle_unit_controllers_participant_idx
  on tactics.battle_unit_controllers (battle_id, participant_id);
