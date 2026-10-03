import { Application, Container, Graphics } from 'pixi.js';
import type { BattleView, GridPoint, TerrainKind, TacticsUnit } from '$lib/core';
import { pointKey, terrainAt } from '$lib/core';
import type {
  BattlefieldInteractionHandlers,
  BattlefieldOverlay,
  BattlefieldRenderer
} from './BattlefieldRenderer';

const CELL_SIZE = 36;
const BOARD_PADDING = 18;

const TERRAIN_COLORS: Record<TerrainKind, number> = {
  ground: 0x26392b,
  difficult: 0x59623a,
  tree: 0x173522,
  rock: 0x59615c,
  water: 0x315b70
};

export class PixiBattlefieldRenderer implements BattlefieldRenderer {
  private app: Application | undefined;
  private scene: Container | undefined;
  private battle: BattleView | undefined;
  private handlers: BattlefieldInteractionHandlers = {};

  async mount(
    host: HTMLElement,
    battle: BattleView,
    handlers: BattlefieldInteractionHandlers = {}
  ): Promise<void> {
    this.destroy();

    const app = new Application();
    await app.init({
      antialias: true,
      background: '#101913',
      width: battle.map.width * CELL_SIZE + BOARD_PADDING * 2,
      height: battle.map.height * CELL_SIZE + BOARD_PADDING * 2,
      resolution: Math.min(globalThis.devicePixelRatio ?? 1, 2),
      autoDensity: true
    });

    app.canvas.setAttribute('aria-label', `${battle.name} tactical battlefield`);
    app.canvas.setAttribute('role', 'application');
    app.canvas.classList.add('battlefield-canvas');
    host.replaceChildren(app.canvas);

    this.app = app;
    this.scene = new Container();
    this.battle = battle;
    this.handlers = handlers;
    app.stage.addChild(this.scene);

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointertap', (event) => {
      const cell = this.cellFromPoint(event.global);
      if (cell) this.handlers.onCellClick?.(cell);
    });
    app.stage.on('pointermove', (event) => {
      this.handlers.onCellHover?.(this.cellFromPoint(event.global));
    });
    app.stage.on('pointerleave', () => this.handlers.onCellHover?.(undefined));

    this.render(battle);
  }

  render(battle: BattleView, overlay: BattlefieldOverlay = {}): void {
    if (!this.scene) return;
    this.battle = battle;
    this.scene.removeChildren().forEach((child) => child.destroy({ children: true }));

    this.scene.addChild(this.drawBoard(battle, overlay));
    if (overlay.previewPath && overlay.previewPath.length > 1) {
      this.scene.addChild(this.drawPath(overlay.previewPath));
    }
    for (const unit of battle.units) {
      this.scene.addChild(this.drawUnit(unit, unit.id === overlay.selectedUnitId));
    }
  }

  destroy(): void {
    if (!this.app) return;
    this.app.destroy(true, { children: true });
    this.app = undefined;
    this.scene = undefined;
    this.battle = undefined;
    this.handlers = {};
  }

  private drawBoard(battle: BattleView, overlay: BattlefieldOverlay): Graphics {
    const graphics = new Graphics();
    const reachable = new Set((overlay.reachableCells ?? []).map((cell) => pointKey(cell.position)));

    for (let y = 0; y < battle.map.height; y += 1) {
      for (let x = 0; x < battle.map.width; x += 1) {
        const point = { x, y };
        const left = BOARD_PADDING + x * CELL_SIZE;
        const top = BOARD_PADDING + y * CELL_SIZE;
        const terrain = terrainAt(battle.map, point);
        const alternate = (x + y) % 2 === 0;
        const baseColor = TERRAIN_COLORS[terrain];

        graphics
          .rect(left, top, CELL_SIZE, CELL_SIZE)
          .fill({ color: baseColor, alpha: terrain === 'ground' && !alternate ? 0.88 : 1 })
          .stroke({ color: 0x3f5845, width: 1, alpha: 0.6 });

        if (reachable.has(pointKey(point))) {
          graphics
            .rect(left + 2, top + 2, CELL_SIZE - 4, CELL_SIZE - 4)
            .fill({ color: 0x8dcf84, alpha: 0.16 });
        }
      }
    }

    return graphics;
  }

  private drawPath(points: readonly GridPoint[]): Graphics {
    const graphics = new Graphics();
    const start = this.cellCenter(points[0]);
    graphics.moveTo(start.x, start.y);
    for (const point of points.slice(1)) {
      const center = this.cellCenter(point);
      graphics.lineTo(center.x, center.y);
    }
    graphics.stroke({ color: 0xf4e98a, width: 5, alpha: 0.85 });

    for (const point of points.slice(1)) {
      const center = this.cellCenter(point);
      graphics.circle(center.x, center.y, 4).fill({ color: 0xfff3a6, alpha: 0.95 });
    }
    return graphics;
  }

  private drawUnit(unit: TacticsUnit, selected: boolean): Container {
    const center = this.cellCenter(unit.position);
    const isTrainer = unit.kind === 'trainer';
    const isAlly = unit.teamId === 'allies';
    const radius = isTrainer ? 11 : 13;
    const container = new Container();

    if (selected) {
      container.addChild(
        new Graphics()
          .circle(center.x, center.y, radius + 7)
          .stroke({ color: 0xffef82, width: 3, alpha: 0.95 })
      );
    }

    const token = new Graphics()
      .circle(center.x, center.y, radius)
      .fill(isAlly ? 0xd9c56d : 0xa95858)
      .stroke({ color: 0xf4efd9, width: isTrainer ? 2 : 3 });

    token.label = unit.name;
    token.eventMode = 'static';
    token.cursor = 'pointer';
    token.on('pointertap', (event) => {
      event.stopPropagation();
      this.handlers.onUnitClick?.(unit.id);
    });
    container.addChild(token);
    return container;
  }

  private cellFromPoint(point: Readonly<{ x: number; y: number }>): GridPoint | undefined {
    if (!this.battle) return undefined;
    const x = Math.floor((point.x - BOARD_PADDING) / CELL_SIZE);
    const y = Math.floor((point.y - BOARD_PADDING) / CELL_SIZE);
    if (x < 0 || y < 0 || x >= this.battle.map.width || y >= this.battle.map.height) return undefined;
    return Object.freeze({ x, y });
  }

  private cellCenter(point: GridPoint): GridPoint {
    return {
      x: BOARD_PADDING + point.x * CELL_SIZE + CELL_SIZE / 2,
      y: BOARD_PADDING + point.y * CELL_SIZE + CELL_SIZE / 2
    };
  }
}
