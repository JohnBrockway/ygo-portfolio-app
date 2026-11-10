import type { CSSProperties } from "react";

// How far each image behind the front one is shifted to the right and up, as a % of the tile image area's
// width and height. The height step is smaller because the area is taller than it is wide, which makes the
// offsets about equal in pixels.
const STEP_X = 8;
const STEP_Y = 6;

// How much darker each step back is, so the images behind the front one fade into the tile's dark background.
const FADE_PER_STEP = 0.3;

// Where the image `depth` steps back (0 is the front one) goes, and how it looks. The images shrink by the room
// the offsets need, so the whole stack fits inside the area.
function imageStyle(depth: number, imageCount: number): CSSProperties {
  const stepsBack = imageCount - 1;
  const brightness = Math.max(0.2, 1 - depth * FADE_PER_STEP);

  return {
    left: `${depth * STEP_X}%`,
    top: `${(stepsBack - depth) * STEP_Y}%`,
    width: `${100 - stepsBack * STEP_X}%`,
    height: `${100 - stepsBack * STEP_Y}%`,
    zIndex: imageCount - depth,
    filter: `brightness(${brightness}) drop-shadow(2px -2px 4px rgba(0, 0, 0, 0.6))`,
  };
}

// A tile image made of several images stacked like a pile of cards: the first one in front at the lower left,
// each of the others behind it, a step further up and to the right and a step darker.
export function TileStack({ imageUrls }: { imageUrls: string[] }) {
  return (
    <div className="tile-image tile-stack">
      <div className="tile-stack-area">
        {imageUrls.map((url, depth) => (
          <img key={url} src={url} alt="" loading="lazy" style={imageStyle(depth, imageUrls.length)} />
        ))}
      </div>
    </div>
  );
}