import { ARENAS } from './arenas/arenas';
import { HEROES } from './heroes';
import { spriteCache } from './SpriteCache';
import {
  ArenaDefinition,
  ControlScheme,
  FighterEntity,
  GuardDirection,
  Language,
  WorldSnapshot,
} from './types';

interface ParallaxLayerCache {
  key: string;
  tileW: number;
  tileH: number;
  source: HTMLCanvasElement | ImageBitmap;
}

export class CanvasRenderer {
  private camX = 400;
  private camY = 300;
  private shrineFrame = 0;
  private shrineTimerMs = 0;
  private lastZoom = 1;
  private localScreenPos = { x: 640, y: 360 };
  private layerCaches: Array<ParallaxLayerCache | null> = [null, null, null];

  getLocalFighterScreenPos(): { x: number; y: number } {
    return this.localScreenPos;
  }

  render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    snapshot: WorldSnapshot,
    localPlayerId: string,
    lang: Language,
    dtMs = 16.67,
    lockedTargetId: string | null = null,
    controlScheme: ControlScheme = 'mouse',
    virtualGuardOffset: { x: number; y: number } | null = null
  ): void {
    const arena = ARENAS[snapshot.arenaId] || ARENAS.shattered_bridge;
    const vw = canvas.width;
    const vh = canvas.height;

    this.shrineTimerMs += dtMs;
    if (this.shrineTimerMs >= 115) {
      this.shrineTimerMs %= 115;
      this.shrineFrame = (this.shrineFrame + 1) % 6;
    }

    const focus =
      snapshot.fighters.find((f) => f.id === localPlayerId && f.alive) ||
      snapshot.fighters.find((f) => f.alive) ||
      snapshot.fighters[0];

    const zoom = Math.max(0.72, Math.min(1.05, Math.min(vw / 1280, vh / 720)));
    this.lastZoom = zoom;
    const visibleW = vw / zoom;
    const visibleH = vh / zoom;

    if (focus) {
      const targetCamX = Math.max(
        0,
        Math.min(arena.worldWidth - visibleW, focus.x - visibleW / 2)
      );
      const targetCamY = Math.max(
        0,
        Math.min(arena.worldHeight - visibleH, focus.y + 40 - visibleH * 0.56)
      );
      const lerp = 1 - Math.exp(-dtMs * 0.0085);
      this.camX += (targetCamX - this.camX) * lerp;
      this.camY += (targetCamY - this.camY) * lerp;

      this.localScreenPos = {
        x: (focus.x - this.camX) * this.lastZoom,
        y: (focus.y + focus.height * 0.45 - this.camY) * this.lastZoom,
      };
    }

    const shakeX = snapshot.screenShake > 0 ? (Math.random() - 0.5) * snapshot.screenShake * 1.8 : 0;
    const shakeY = snapshot.screenShake > 0 ? (Math.random() - 0.5) * snapshot.screenShake * 1.8 : 0;

    this.drawBackdrop(ctx, vw, vh);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(zoom, zoom);
    ctx.translate(-this.camX + shakeX, -this.camY + shakeY);

    this.drawEnvironmentProps(ctx, arena);
    this.drawShrine(ctx, arena);
    this.drawZones(ctx, snapshot, lang);
    this.drawPlatforms(ctx, arena);
    this.drawLadders(ctx, arena);
    this.drawGate(ctx, snapshot);

    for (const f of snapshot.fighters) {
      const isLocal = f.id === localPlayerId;
      const isLockedTarget = lockedTargetId !== null && f.id === lockedTargetId;
      this.drawFighter(
        ctx,
        f,
        isLocal,
        isLockedTarget,
        controlScheme,
        isLocal ? virtualGuardOffset : null
      );
    }

    this.drawParticles(ctx, snapshot);
    this.drawCallouts(ctx, snapshot, lang);

    ctx.restore();
  }

  private getParallaxTile(layerIdx: number, src: string, vh: number): ParallaxLayerCache | null {
    const img = spriteCache.get(src);
    if (!img || !img.complete || img.naturalWidth === 0) return null;

    const scale = Math.max(1, vh / img.height);
    const tileW = Math.ceil(img.width * scale);
    const tileH = Math.ceil(img.height * scale);
    const key = `${src}:${tileW}:${tileH}`;

    const existing = this.layerCaches[layerIdx];
    if (existing && existing.key === key) return existing;

    const off = document.createElement('canvas');
    off.width = tileW;
    off.height = tileH;
    const octx = off.getContext('2d');
    if (!octx) return null;

    octx.imageSmoothingEnabled = false;
    octx.drawImage(img, 0, 0, tileW, tileH);

    const entry: ParallaxLayerCache = { key, tileW, tileH, source: off };
    this.layerCaches[layerIdx] = entry;

    if (typeof createImageBitmap === 'function') {
      createImageBitmap(off)
        .then((bmp) => {
          if (this.layerCaches[layerIdx]?.key === key) {
            this.layerCaches[layerIdx] = { key, tileW, tileH, source: bmp };
          }
        })
        .catch(() => {});
    }

    return entry;
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, vw: number, vh: number): void {
    ctx.fillStyle = '#151B28';
    ctx.fillRect(0, 0, vw, vh);

    const layers: Array<{ src: string; speed: number }> = [
      { src: '/assets/environment/backgrounds/layer_1.png', speed: 0.08 },
      { src: '/assets/environment/backgrounds/layer_2.png', speed: 0.22 },
      { src: '/assets/environment/backgrounds/layer_3.png', speed: 0.40 },
    ];

    for (let i = 0; i < layers.length; i++) {
      const tile = this.getParallaxTile(i, layers[i].src, vh);
      if (!tile) continue;

      const offset = ((this.camX * layers[i].speed) % tile.tileW + tile.tileW) % tile.tileW;
      const y = vh - tile.tileH;
      for (let x = -offset; x < vw; x += tile.tileW) {
        ctx.drawImage(tile.source, Math.floor(x), y);
      }
    }

    // Subtle atmospheric dusk tint so combat UI, silhouettes & guard triangles stay high-contrast
    ctx.fillStyle = 'rgba(11, 15, 22, 0.34)';
    ctx.fillRect(0, 0, vw, vh);
  }

  private drawEnvironmentProps(ctx: CanvasRenderingContext2D, arena: ArenaDefinition): void {
    const scale = 2.15;
    const fence1 = spriteCache.get('/assets/environment/props/fence_1.png');
    const fence2 = spriteCache.get('/assets/environment/props/fence_2.png');
    const lamp = spriteCache.get('/assets/environment/props/lamp.png');
    const sign = spriteCache.get('/assets/environment/props/sign.png');
    const rocks = [
      spriteCache.get('/assets/environment/props/rock_1.png'),
      spriteCache.get('/assets/environment/props/rock_2.png'),
      spriteCache.get('/assets/environment/props/rock_3.png'),
    ];
    const grasses = [
      spriteCache.get('/assets/environment/props/grass_1.png'),
      spriteCache.get('/assets/environment/props/grass_2.png'),
      spriteCache.get('/assets/environment/props/grass_3.png'),
    ];

    const drawProp = (img: HTMLImageElement | undefined, x: number, groundY: number) => {
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, Math.round(x - dw / 2), Math.round(groundY - dh), dw, dh);
    };

    const flicker = 0.85 + Math.sin(performance.now() * 0.008) * 0.12;

    for (let idx = 0; idx < arena.platforms.length; idx++) {
      const p = arena.platforms[idx];
      if (p.oneWay && p.width < 290) continue;

      // Ground-tier stone/iron platforms receive fences, lamps, signposts, rocks & grass
      if (!p.oneWay) {
        if (fence1 && p.width >= 480) {
          drawProp(fence1, p.x + p.width * 0.28, p.y);
          drawProp(fence2 || fence1, p.x + p.width * 0.68, p.y);
        }

        if (lamp) {
          const lx = p.x + (idx % 2 === 0 ? p.width * 0.14 : p.width * 0.86);
          const lw = lamp.width * scale;
          const lh = lamp.height * scale;
          const glow = ctx.createRadialGradient(lx, p.y - lh * 0.72, 4, lx, p.y - lh * 0.72, 72);
          glow.addColorStop(0, `rgba(251, 191, 36, ${(0.24 * flicker).toFixed(3)})`);
          glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(lx, p.y - lh * 0.72, 72, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(lamp, Math.round(lx - lw / 2), Math.round(p.y - lh), lw, lh);
        }

        if (sign && idx === 0) {
          drawProp(sign, p.x + p.width - 54, p.y);
        }

        const rockImg = rocks[idx % rocks.length];
        drawProp(rockImg, p.x + p.width * 0.45, p.y);
      }

      // Grass tufts along platforms
      const tufts = Math.max(2, Math.floor(p.width / 170));
      for (let t = 0; t < tufts; t++) {
        const gImg = grasses[(idx + t) % grasses.length];
        const gx = p.x + 38 + ((t + 0.5) / tufts) * (p.width - 76);
        drawProp(gImg, gx, p.y);
      }
    }
  }

  private drawShrine(ctx: CanvasRenderingContext2D, arena: ArenaDefinition): void {
    if (!arena.shrinePosition) return;
    const shop = spriteCache.get('/assets/environment/buildings/shop_anim.png');
    if (!shop || !shop.complete || shop.naturalWidth === 0) return;

    const frameW = shop.width / 6;
    const scale = 2.15;
    const drawW = frameW * scale;
    const drawH = shop.height * scale;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(
      shop,
      this.shrineFrame * frameW,
      0,
      frameW,
      shop.height,
      arena.shrinePosition.x - drawW / 2,
      arena.shrinePosition.y - drawH,
      drawW,
      drawH
    );
    ctx.restore();
  }

  private drawPlatforms(ctx: CanvasRenderingContext2D, arena: ArenaDefinition): void {
    const tileset = spriteCache.get('/assets/environment/tilesets/oak_woods_tileset.png');
    const hasTileset = Boolean(tileset && tileset.complete && tileset.naturalWidth > 0);
    const TILE_SRC = 24;
    const TILE_DST = 48; // crisp 2x integer pixel scale

    for (const p of arena.platforms) {
      if (hasTileset && tileset) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x, p.y, p.width, p.height);
        ctx.clip();

        const cols = Math.ceil(p.width / TILE_DST);
        const rows = Math.ceil(p.height / TILE_DST);

        if (p.oneWay) {
          // Floating ledge row from oak_woods_tileset (row 9 = warm timber/grass, row 7 = stone, row 11 = dark iron)
          const srcRow = p.style === 'iron' ? 11 : p.style === 'stone' ? 7 : 9;
          for (let c = 0; c < cols; c++) {
            const tx = c === 0 ? 5 : c === cols - 1 ? 7 : 6;
            ctx.drawImage(
              tileset,
              tx * TILE_SRC,
              srcRow * TILE_SRC,
              TILE_SRC,
              TILE_SRC,
              p.x + c * TILE_DST,
              p.y,
              TILE_DST,
              TILE_DST
            );
          }
        } else {
          // Thick solid floor block: cobblestone or grass-topped earth
          const isIron = p.style === 'iron';
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              let tx: number;
              let ty: number;
              if (r === 0) {
                ty = 0;
                if (isIron) {
                  tx = c === 0 ? 5 : c === cols - 1 ? 8 : 6 + (c % 2);
                } else {
                  tx = c === 0 ? 0 : c === cols - 1 ? 3 : 1 + (c % 2);
                }
              } else {
                ty = 1;
                tx = isIron ? 15 : 1;
              }
              ctx.drawImage(
                tileset,
                tx * TILE_SRC,
                ty * TILE_SRC,
                TILE_SRC,
                TILE_SRC,
                p.x + c * TILE_DST,
                p.y + r * TILE_DST,
                TILE_DST,
                TILE_DST
              );
            }
          }
        }

        ctx.restore();

        if (p.style === 'iron') {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(p.x, p.y, p.width, p.height);
        }
        continue;
      }

      // Fallback when tileset image isn't loaded yet
      if (p.style === 'stone') {
        ctx.fillStyle = '#1E2430';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#334155';
        ctx.fillRect(p.x, p.y, p.width, 8);
      } else if (p.style === 'iron') {
        ctx.fillStyle = '#262E3D';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#64748B';
        ctx.fillRect(p.x, p.y, p.width, 5);
      } else {
        ctx.fillStyle = '#4A3121';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#8B5A2B';
        ctx.fillRect(p.x, p.y, p.width, 5);
      }
    }
  }

  private drawLadders(ctx: CanvasRenderingContext2D, arena: ArenaDefinition): void {
    for (const lad of arena.ladders) {
      const leftRailX = lad.x + 6;
      const rightRailX = lad.x + lad.width - 12;
      const railW = 6;

      // Subtle dark backing shadow behind rails for visual contrast against backgrounds
      ctx.fillStyle = 'rgba(9, 12, 18, 0.42)';
      ctx.fillRect(lad.x + 3, lad.y, lad.width - 6, lad.height);

      // Vertical timber rails with warm oak edge highlight
      ctx.fillStyle = '#3E2718';
      ctx.fillRect(leftRailX, lad.y, railW, lad.height);
      ctx.fillRect(rightRailX, lad.y, railW, lad.height);
      ctx.fillStyle = '#6B4429';
      ctx.fillRect(leftRailX, lad.y, 2, lad.height);
      ctx.fillRect(rightRailX, lad.y, 2, lad.height);

      // Horizontal wooden rungs + iron rivets every 28px
      const step = 28;
      for (let ry = lad.y + 16; ry < lad.y + lad.height - 6; ry += step) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(leftRailX + 2, ry + 5, lad.width - 16, 2);

        ctx.fillStyle = '#8C5B38';
        ctx.fillRect(leftRailX + 1, ry, lad.width - 14, 5);
        ctx.fillStyle = '#B87D50';
        ctx.fillRect(leftRailX + 1, ry, lad.width - 14, 2);

        // Iron nails at rail joints
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(leftRailX + 2, ry + 1, 2, 2);
        ctx.fillRect(rightRailX + 2, ry + 1, 2, 2);
      }

      // Top & bottom iron mounting brackets flush with upper platform edge
      ctx.fillStyle = '#475569';
      ctx.fillRect(leftRailX - 1, lad.y, railW + 2, 5);
      ctx.fillRect(rightRailX - 1, lad.y, railW + 2, 5);
    }
  }

  private drawZones(
    ctx: CanvasRenderingContext2D,
    snapshot: WorldSnapshot,
    lang: Language
  ): void {
    for (const z of snapshot.zones) {
      const color =
        z.owner === 'iron'
          ? '#3B82F6'
          : z.owner === 'crimson'
          ? '#EF4444'
          : '#94A3B8';

      ctx.fillStyle =
        z.owner === 'iron'
          ? 'rgba(59,130,246,0.16)'
          : z.owner === 'crimson'
          ? 'rgba(239,68,68,0.16)'
          : 'rgba(148,163,184,0.10)';
      ctx.fillRect(z.x, z.y, z.width, z.height);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(z.x, z.y + z.height - 8, z.width, 8);

      const norm = Math.abs(z.progress) / 100;
      ctx.fillStyle = z.progress >= 0 ? '#3B82F6' : '#EF4444';
      ctx.fillRect(z.x, z.y + z.height - 8, z.width * norm, 8);

      ctx.fillStyle = color;
      ctx.font = '700 18px "Cinzel", serif';
      ctx.textAlign = 'center';
      const label = z.contested
        ? `[${z.id}] ${lang === 'pl' ? 'SPORNA' : 'CONTESTED'}`
        : `[${z.id}] ${lang === 'pl' ? z.namePl : z.nameEn}`;
      ctx.fillText(label, z.x + z.width / 2, z.y + 24);
    }
  }

  private drawGate(ctx: CanvasRenderingContext2D, snapshot: WorldSnapshot): void {
    const g = snapshot.gate;
    if (!g) return;

    if (g.breached) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.fillRect(g.x, g.y + g.height - 30, g.width, 30);
      return;
    }

    ctx.fillStyle = g.underAttack ? '#451A1A' : '#1E293B';
    ctx.fillRect(g.x, g.y, g.width, g.height);
    ctx.strokeStyle = g.underAttack ? '#F59E0B' : '#64748B';
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x, g.y, g.width, g.height);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    for (let y = g.y + 35; y < g.y + g.height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(g.x + 8, y);
      ctx.lineTo(g.x + g.width - 8, y);
      ctx.stroke();
    }

    const pct = Math.max(0, g.hp / g.maxHp);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(g.x - 15, g.y - 26, g.width + 30, 12);
    ctx.fillStyle = pct > 0.35 ? '#F59E0B' : '#EF4444';
    ctx.fillRect(g.x - 13, g.y - 24, (g.width + 26) * pct, 8);
  }

  private drawFighter(
    ctx: CanvasRenderingContext2D,
    f: FighterEntity,
    isLocal: boolean,
    isLockedTarget: boolean,
    controlScheme: ControlScheme,
    virtualGuardOffset: { x: number; y: number } | null
  ): void {
    const hero = HEROES[f.heroId];
    const skin = hero.skins[f.skinIndex % hero.skins.length];
    const anim = hero.sprites[f.animName];
    const spriteSource = spriteCache.getTinted(anim.src, skin.canvasFilter);

    ctx.save();

    if (f.invulnTimerMs > 0 && Math.floor(f.invulnTimerMs / 60) % 2 === 0) {
      ctx.globalAlpha = 0.6;
    }

    const teamColor = f.team === 'iron' ? '#3B82F6' : '#EF4444';

    // Ground highlight ring ONLY on main player and focused enemy; nothing under everyone else
    if (f.alive && isLocal) {
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + f.height + 2, 42, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.30)';
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(f.x, f.y + f.height + 2, 28, 7.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (f.alive && isLockedTarget) {
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + f.height + 2, 38, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (spriteSource) {
      const frameW = spriteSource.width / anim.frames;
      const drawW = frameW * hero.scale;
      const drawH = spriteSource.height * hero.scale;
      const footX = f.x;
      const topY = f.y + f.height - 142;

      if (f.facing === -1) {
        ctx.save();
        ctx.translate(footX + drawW / 2 - (hero.offset.x - 210), 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
          spriteSource,
          f.animFrame * frameW,
          0,
          frameW,
          spriteSource.height,
          0,
          topY - hero.offset.y,
          drawW,
          drawH
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          spriteSource,
          f.animFrame * frameW,
          0,
          frameW,
          spriteSource.height,
          footX - drawW / 2 + (hero.offset.x - 210),
          topY - hero.offset.y,
          drawW,
          drawH
        );
      }
    } else {
      ctx.fillStyle = teamColor;
      ctx.fillRect(f.x - f.width / 2, f.y, f.width, f.height);
    }

    if (!f.alive) {
      ctx.restore();
      return;
    }

    if (
      f.actionState === 'windup_light' ||
      f.actionState === 'windup_heavy' ||
      f.actionState === 'active_light' ||
      f.actionState === 'active_heavy' ||
      f.actionState === 'active_counter'
    ) {
      this.drawAttackTelegraph(ctx, f, skin.trailHex);
    }

    const barW = isLocal ? 86 : 76;
    const barX = f.x - barW / 2;
    const barY = f.y - 54;

    ctx.fillStyle = 'rgba(14, 17, 22, 0.9)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 13);
    if (isLocal) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX - 1.5, barY - 1.5, barW + 3, 14);
    }

    const hpPct = Math.max(0, f.hp / f.maxHp);
    ctx.fillStyle = teamColor;
    ctx.fillRect(barX, barY, barW * hpPct, 7);

    if (f.revengeShield > 0) {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(barX, barY, barW * Math.min(1, f.revengeShield / 50), 3);
    }

    const stamPct = Math.max(0, f.stamina / f.maxStamina);
    ctx.fillStyle = f.oosExhausted ? '#EF4444' : '#E2E8F0';
    ctx.fillRect(barX, barY + 8, barW * stamPct, 3);

    ctx.font = isLocal
      ? '700 12px "Plus Jakarta Sans", sans-serif'
      : '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isLocal ? '#FACC15' : '#E2E8F0';
    const badge = isLocal
      ? `▼ ${f.name}`
      : f.isBot
      ? `[BOT] ${f.name}`
      : f.name;
    ctx.fillText(badge, f.x, barY - 6);

    if (isLockedTarget) {
      this.drawLockReticle(ctx, f);
    }

    // Only show guard indicator for the local player OR the currently Alt-focused opponent!
    if (isLocal || isLockedTarget) {
      this.drawGuardWidget(ctx, f, teamColor, isLocal, controlScheme, virtualGuardOffset);
    }

    ctx.restore();
  }

  private drawLockReticle(ctx: CanvasRenderingContext2D, f: FighterEntity): void {
    const cx = f.x;
    const cy = f.y + f.height * 0.48;
    const rx = 42;
    const ry = 56;
    const b = 12;

    ctx.save();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;

    // 4 tactical target corner brackets around focused opponent
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy - ry + b);
    ctx.lineTo(cx - rx, cy - ry);
    ctx.lineTo(cx - rx + b, cy - ry);

    ctx.moveTo(cx + rx - b, cy - ry);
    ctx.lineTo(cx + rx, cy - ry);
    ctx.lineTo(cx + rx, cy - ry + b);

    ctx.moveTo(cx - rx, cy + ry - b);
    ctx.lineTo(cx - rx, cy + ry);
    ctx.lineTo(cx - rx + b, cy + ry);

    ctx.moveTo(cx + rx - b, cy + ry);
    ctx.lineTo(cx + rx, cy + ry);
    ctx.lineTo(cx + rx, cy + ry - b);
    ctx.stroke();
    ctx.restore();
  }

  private drawGuardWidget(
    ctx: CanvasRenderingContext2D,
    f: FighterEntity,
    teamColor: string,
    isLocal: boolean,
    controlScheme: ControlScheme,
    virtualGuardOffset: { x: number; y: number } | null
  ): void {
    // True closed 3-sided directional guard triangle spanning full character height
    const gx = f.x;
    const gy = f.y + f.height * 0.44;

    const topLeft = { x: gx - 64, y: gy - 70 };
    const topRight = { x: gx + 64, y: gy - 70 };
    const apexBottom = { x: gx, y: gy + 68 };

    const dirs: Array<{
      dir: GuardDirection;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }> = [
      { dir: 'top', x1: topLeft.x, y1: topLeft.y, x2: topRight.x, y2: topRight.y },
      { dir: 'left', x1: topLeft.x, y1: topLeft.y, x2: apexBottom.x, y2: apexBottom.y },
      { dir: 'right', x1: topRight.x, y1: topRight.y, x2: apexBottom.x, y2: apexBottom.y },
    ];

    const isAttacking =
      f.actionState === 'windup_light' ||
      f.actionState === 'windup_heavy' ||
      f.actionState === 'active_light' ||
      f.actionState === 'active_heavy';

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Closed triangle backing & thin frame so all 3 corners join cleanly
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(apexBottom.x, apexBottom.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(14, 17, 22, 0.24)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.36)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw inactive edges cleanly, then active edge prominently on top
    const activeDir: GuardDirection = isAttacking ? f.attackDir : f.guardDir;
    const activeSeg = dirs.find((d) => d.dir === activeDir);

    if (activeSeg) {
      ctx.beginPath();
      ctx.moveTo(activeSeg.x1, activeSeg.y1);
      ctx.lineTo(activeSeg.x2, activeSeg.y2);

      if (f.parryWindowOpen) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 9;
      } else if (isAttacking) {
        ctx.strokeStyle = f.actionState.includes('heavy') ? '#F97316' : '#EF4444';
        ctx.lineWidth = 8.5;
      } else {
        ctx.strokeStyle =
          f.counterReadyTimerMs > 0
            ? '#FACC15'
            : isLocal
            ? '#38BDF8'
            : teamColor;
        ctx.lineWidth = 8.5;
      }
      ctx.stroke();
    }

    // Centered virtual mouse guard dot inside the local player's guard triangle
    if (isLocal && controlScheme === 'mouse' && virtualGuardOffset) {
      const mx = gx + virtualGuardOffset.x * 1.15;
      const my = gy + virtualGuardOffset.y * 1.15;
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (f.parryWindowOpen) {
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(gx, gy - 14, 8.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawAttackTelegraph(
    ctx: CanvasRenderingContext2D,
    f: FighterEntity,
    trailHex: string
  ): void {
    const isHeavy = f.actionState === 'windup_heavy' || f.actionState === 'active_heavy';
    const isCounter = f.actionState === 'active_counter';
    const isActive = f.actionState.startsWith('active_');
    const isWindup = f.actionState.startsWith('windup_');

    if (isActive) {
      const hero = HEROES[f.heroId];
      const reach = hero.attackRange + (isCounter ? 24 : 0);
      const sx = f.facing === 1 ? f.x + 20 : f.x - reach;
      ctx.fillStyle = isCounter
        ? 'rgba(245, 158, 11, 0.38)'
        : isHeavy
        ? 'rgba(249, 115, 22, 0.3)'
        : 'rgba(248, 250, 252, 0.22)';
      ctx.fillRect(sx, f.y + 18, reach - 20, 62);
      ctx.strokeStyle = isCounter ? '#F59E0B' : trailHex;
      ctx.lineWidth = isCounter ? 3 : 2;
      ctx.strokeRect(sx, f.y + 18, reach - 20, 62);
    } else if (isWindup) {
      const progress =
        f.stateDurationMs > 0 ? Math.min(1, f.stateTimerMs / f.stateDurationMs) : 0.25;
      const cx = f.x + f.facing * 18;
      const cy = f.y + 46;
      const dirAngle =
        f.attackDir === 'top'
          ? -Math.PI / 2
          : f.facing === 1
          ? f.attackDir === 'right'
            ? 0
            : Math.PI
          : f.attackDir === 'left'
          ? Math.PI
          : 0;

      ctx.save();
      ctx.strokeStyle = f.parryWindowOpen
        ? '#FACC15'
        : isHeavy
        ? 'rgba(249, 115, 22, 0.85)'
        : 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = f.parryWindowOpen ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 24 + progress * 10, dirAngle - 0.75, dirAngle + 0.75);
      ctx.stroke();

      if (f.parryWindowOpen) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, snapshot: WorldSnapshot): void {
    if (snapshot.particles.length === 0) return;
    ctx.lineWidth = 3;
    for (const p of snapshot.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.kind === 'ring') {
        const progress = p.lifeMs / p.maxLifeMs;
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12 + p.size * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawCallouts(
    ctx: CanvasRenderingContext2D,
    snapshot: WorldSnapshot,
    lang: Language
  ): void {
    if (snapshot.callouts.length === 0) return;
    ctx.font = '700 14px "Cinzel", serif';
    ctx.textAlign = 'center';
    for (const c of snapshot.callouts) {
      ctx.globalAlpha = Math.max(0, 1 - c.lifeMs / c.maxLifeMs);
      ctx.fillStyle = '#0B0F16';
      const label = lang === 'pl' ? c.textPl : c.textEn;
      ctx.fillText(label, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(label, c.x, c.y);
    }
    ctx.globalAlpha = 1;
  }
}
