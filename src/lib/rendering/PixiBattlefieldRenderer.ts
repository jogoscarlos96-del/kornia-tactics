import { Application, Container, Graphics } from 'pixi.js';
import type { BattleView, TacticsUnit } from '$lib/core';
import type { BattlefieldRenderer } from './BattlefieldRenderer';

const CELL_SIZE = 36;
const BOARD_PADDING = 18;

export class PixiBattlefieldRenderer implements BattlefieldRenderer {
  private app: Application | undefined;
  private scene: Container | undefined;

  async mount(host: HTMLElement, battle: BattleView): Promise<void> {
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
    app.canvas.setAttribute('role', 'img');
    app.canvas.classList.add('battlefield-canvas');
    host.replaceChildren(app.canvas);

    this.app = app;
    this.scene = new Container();
    app.stage.addChild(this.scene);
    this.render(battle);
  }

  render(battle: BattleView): void {
    if (!this.scene) return;
    this.scene.removeChildren().forEach((child) => child.destroy());

    this.scene.addChild(this.drawBoard(battle));
    for (const unit of battle.units) this.scene.addChild(this.drawUnit(unit));
  }

  destroy(): void {
    if (!this.app) return;
    this.app.destroy(true, { children: true });
    this.app = undefined;
    this.scene = undefined;
  }

  private drawBoard(battle: BattleView): Graphics {
    const graphics = new Graphics();

    for (let y = 0; y < battle.map.height; y += 1) {
      for (let x = 0; x < battle.map.width; x += 1) {
        const left = BOARD_PADDING + x * CELL_SIZE;
        const top = BOARD_PADDING + y * CELL_SIZE;
        const alternate = (x + y) % 2 === 0;

        graphics
          .rect(left, top, CELL_SIZE, CELL_SIZE)
          .fill(alternate ? 0x26392b : 0x223326)
          .stroke({ color: 0x3f5845, width: 1, alpha: 0.6 });
      }
    }

    return graphics;
  }

  private drawUnit(unit: TacticsUnit): Graphics {
    const centerX = BOARD_PADDING + unit.position.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = BOARD_PADDING + unit.position.y * CELL_SIZE + CELL_SIZE / 2;
    const isTrainer = unit.kind === 'trainer';
    const isAlly = unit.teamId === 'allies';
    const radius = isTrainer ? 11 : 13;

    const token = new Graphics()
      .circle(centerX, centerY, radius)
      .fill(isAlly ? 0xd9c56d : 0xa95858)
      .stroke({ color: 0xf4efd9, width: isTrainer ? 2 : 3 });

    token.label = unit.name;
    return token;
  }
}
