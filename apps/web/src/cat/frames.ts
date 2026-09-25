import { palette, type CatLook } from './look';
import { ANIMS, FRAME_H, FRAME_W, poseAt, renderFrame, type Anim } from './sprite';

const cache = new Map<string, HTMLCanvasElement[]>();

/** Rendered frames for a look + animation, cached for the page's lifetime. */
export function framesFor(look: CatLook, anim: Anim): HTMLCanvasElement[] {
  const key = JSON.stringify(look) + anim;
  let frames = cache.get(key);
  if (!frames) {
    const pal = palette(look);
    frames = Array.from({ length: ANIMS[anim].frames }, (_, i) => {
      const c = document.createElement('canvas');
      c.width = FRAME_W;
      c.height = FRAME_H;
      const img = new ImageData(renderFrame(poseAt(anim, i), look, pal), FRAME_W, FRAME_H);
      c.getContext('2d')!.putImageData(img, 0, 0);
      return c;
    });
    cache.set(key, frames);
  }
  return frames;
}
