import { HERO_LIST } from './heroes';

export type CachedSpriteSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

class SpriteCache {
  private images = new Map<string, HTMLImageElement>();
  private tintedCache = new Map<string, HTMLCanvasElement | ImageBitmap>();
  private loaded = false;

  get(src: string): HTMLImageElement | undefined {
    return this.images.get(src);
  }

  /**
   * Returns pre-baked ImageBitmap / offscreen canvas so the 60fps draw loop
   * never executes slow per-frame ctx.filter passes.
   */
  getTinted(src: string, filter: string): CachedSpriteSource | undefined {
    const base = this.images.get(src);
    if (!base || !base.complete || base.naturalWidth === 0) return undefined;
    if (!filter || filter === 'none') return base;

    const key = `${src}::${filter}`;
    const existing = this.tintedCache.get(key);
    if (existing) return existing;

    const offscreen = document.createElement('canvas');
    offscreen.width = base.naturalWidth;
    offscreen.height = base.naturalHeight;
    const octx = offscreen.getContext('2d');
    if (!octx) return base;

    octx.filter = filter;
    octx.drawImage(base, 0, 0);
    octx.filter = 'none';
    this.tintedCache.set(key, offscreen);

    if (typeof createImageBitmap === 'function') {
      createImageBitmap(offscreen)
        .then((bmp) => {
          this.tintedCache.set(key, bmp);
        })
        .catch(() => {});
    }

    return offscreen;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async preloadAll(onProgress?: (pct: number) => void): Promise<void> {
    if (this.loaded) {
      onProgress?.(100);
      return;
    }

    const urls = new Set<string>([
      '/assets/environment/backgrounds/layer_1.png',
      '/assets/environment/backgrounds/layer_2.png',
      '/assets/environment/backgrounds/layer_3.png',
      '/assets/environment/tilesets/oak_woods_tileset.png',
      '/assets/environment/buildings/shop_anim.png',
      '/assets/environment/props/fence_1.png',
      '/assets/environment/props/fence_2.png',
      '/assets/environment/props/grass_1.png',
      '/assets/environment/props/grass_2.png',
      '/assets/environment/props/grass_3.png',
      '/assets/environment/props/rock_1.png',
      '/assets/environment/props/rock_2.png',
      '/assets/environment/props/rock_3.png',
      '/assets/environment/props/lamp.png',
      '/assets/environment/props/sign.png',
    ]);

    for (const hero of HERO_LIST) {
      urls.add(hero.avatarSrc);
      for (const anim of Object.values(hero.sprites)) {
        urls.add(anim.src);
      }
    }

    const list = Array.from(urls);
    let completed = 0;

    await Promise.all(
      list.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.images.set(src, img);
              completed++;
              onProgress?.(Math.round((completed / list.length) * 100));
              resolve();
            };
            img.onerror = () => {
              completed++;
              onProgress?.(Math.round((completed / list.length) * 100));
              resolve();
            };
            img.src = src;
          })
      )
    );

    // Pre-bake only the active skins cleanly into ImageBitmaps upfront
    const bitmapTasks: Promise<void>[] = [];
    for (const hero of HERO_LIST) {
      for (const skin of hero.skins) {
        if (skin.canvasFilter === 'none') continue;
        for (const anim of Object.values(hero.sprites)) {
          const base = this.images.get(anim.src);
          if (!base || !base.complete || base.naturalWidth === 0) continue;
          const key = `${anim.src}::${skin.canvasFilter}`;
          if (this.tintedCache.has(key)) continue;

          const offscreen = document.createElement('canvas');
          offscreen.width = base.naturalWidth;
          offscreen.height = base.naturalHeight;
          const octx = offscreen.getContext('2d');
          if (!octx) continue;
          octx.filter = skin.canvasFilter;
          octx.drawImage(base, 0, 0);
          octx.filter = 'none';
          this.tintedCache.set(key, offscreen);

          if (typeof createImageBitmap === 'function') {
            bitmapTasks.push(
              createImageBitmap(offscreen)
                .then((bmp) => {
                  this.tintedCache.set(key, bmp);
                })
                .catch(() => {})
            );
          }
        }
      }
    }

    await Promise.all(bitmapTasks);
    this.loaded = true;
    onProgress?.(100);
  }
}

export const spriteCache = new SpriteCache();
