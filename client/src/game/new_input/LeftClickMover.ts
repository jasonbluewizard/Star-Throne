export interface MoveOrder {
  originIds: number[];
  destId: number;
  percent: number;
}

export interface LeftClickMoverOptions {
  defaultPercent?: number;
}

export class LeftClickMover {
  private canvas: HTMLCanvasElement;
  private game: any;

  private selected: number[] = [];
  private dragSendPercent: number;
  private dragState: any = null;
  private boxSelectState: any = null;

  constructor(game: any, opts: LeftClickMoverOptions = {}) {
    this.game = game;
    this.canvas = game.canvas;
    this.dragSendPercent = opts.defaultPercent ?? 100;

    this.bindHandlers();
  }

  private bindHandlers() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }

  cleanup() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }

  // Event handlers are arrow functions so 'this' stays bound
  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.getLocalPos(e);
    const p = this.pickTerritoryAt(x, y);
    if (p) {
      if (e.shiftKey) this.toggleSelection(p.id);
      else this.setSelection([p.id]);
      this.dragState = { originIds: [...this.selected], startX: x, startY: y, active: false };
    } else {
      this.boxSelectState = { x0: x, y0: y };
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const { x, y } = this.getLocalPos(e);
    if (this.dragState && !this.dragState.active) {
      const dx = x - this.dragState.startX;
      const dy = y - this.dragState.startY;
      if (Math.hypot(dx, dy) > 8) {
        this.dragState.active = true;
      }
    }
    if (this.dragState && this.dragState.active) {
      this.dragState.curX = x;
      this.dragState.curY = y;
      this.dragState.hover = this.pickTerritoryAt(x, y);
      // TODO: arrow preview drawing via game.ui
    }
    if (this.boxSelectState) {
      this.boxSelectState.curX = x;
      this.boxSelectState.curY = y;
      // TODO: box select overlay
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const { x, y } = this.getLocalPos(e);
    if (this.boxSelectState) {
      this.finalizeBoxSelect(this.boxSelectState, x, y);
      this.boxSelectState = null;
      return;
    }
    if (this.dragState && this.dragState.active && this.dragState.hover) {
      this.issueMoveOrder(this.dragState.originIds, this.dragState.hover.id, this.dragSendPercent);
    }
    this.dragState = null;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.dragState?.active) {
      this.dragSendPercent = Math.min(100, Math.max(10, this.dragSendPercent + (e.deltaY < 0 ? 10 : -10)));
    }
  };

  private rangeOverlayVisible = false;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.dragState = null;
    if (e.key === ' ') this.rangeOverlayVisible = true;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ') this.rangeOverlayVisible = false;
  };

  private getLocalPos(e: PointerEvent | WheelEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private pickTerritoryAt(x: number, y: number) {
    const world = this.game.camera.screenToWorld(x, y);
    return this.game.findTerritoryAt(world.x, world.y);
  }

  private finalizeBoxSelect(box: any, x: number, y: number) {
    const x1 = Math.min(box.x0, x);
    const y1 = Math.min(box.y0, y);
    const x2 = Math.max(box.x0, x);
    const y2 = Math.max(box.y0, y);
    const ids: number[] = [];
    for (const id of this.game.humanPlayer.territories) {
      const t = this.game.gameMap.territories[id];
      const sx = this.game.camera.worldToScreenX(t.x);
      const sy = this.game.camera.worldToScreenY(t.y);
      if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) ids.push(id);
    }
    this.setSelection(ids);
  }

  private setSelection(ids: number[]) {
    this.selected = ids;
    if (this.game.ui?.flashSelection) this.game.ui.flashSelection(ids);
  }

  private toggleSelection(id: number) {
    const idx = this.selected.indexOf(id);
    if (idx >= 0) this.selected.splice(idx, 1);
    else this.selected.push(id);
    if (this.game.ui?.flashSelection) this.game.ui.flashSelection(this.selected);
  }

  private issueMoveOrder(originIds: number[], destId: number, percent: number) {
    const dest = this.game.gameMap.territories[destId];
    for (const oId of originIds) {
      const from = this.game.gameMap.territories[oId];
      const pct = percent / 100;
      const attack = dest.ownerId !== this.game.humanPlayer.id;
      this.game.issueFleetCommand(from, dest, pct, attack);
    }
  }

  // Getters for external access
  get selectedTerritories() {
    return [...this.selected];
  }

  get isDragging() {
    return this.dragState?.active || false;
  }

  get showRangeOverlay() {
    return this.rangeOverlayVisible;
  }
}

export default LeftClickMover;