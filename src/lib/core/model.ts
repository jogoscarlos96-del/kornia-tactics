export type UnitId = string;
export type TeamId = 'allies' | 'opponents';
export type ControllerKind = 'PLAYER' | 'DM' | 'AI';

export type GridPoint = Readonly<{
  x: number;
  y: number;
}>;

export type SpeciesReference = Readonly<{
  id: string;
  kind: 'official' | 'fakemon';
}>;

export type MovementCapability = 'walk' | 'swim' | 'fly';

export type MovementProfile = Readonly<{
  speed: number;
  capabilities: readonly MovementCapability[];
}>;

export type TerrainKind = 'ground' | 'difficult' | 'tree' | 'rock' | 'water';

export type TerrainPlacement = Readonly<{
  position: GridPoint;
  kind: Exclude<TerrainKind, 'ground'>;
}>;

export type TacticsUnit = Readonly<{
  id: UnitId;
  name: string;
  kind: 'trainer' | 'pokemon';
  teamId: TeamId;
  controller: ControllerKind;
  position: GridPoint;
  movement: MovementProfile;
  species?: SpeciesReference;
}>;

export type BattleMap = Readonly<{
  id: string;
  name: string;
  width: number;
  height: number;
  terrain: readonly TerrainPlacement[];
}>;

export type BattleView = Readonly<{
  id: string;
  name: string;
  map: BattleMap;
  units: readonly TacticsUnit[];
}>;
