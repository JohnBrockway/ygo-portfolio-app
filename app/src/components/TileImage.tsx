import { useState } from "react";

// The image area of a tile: the picture, or a placeholder if there is no URL or it fails to load.
export function TileImage({ imageUrl }: { imageUrl: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="tile-image">
      {imageUrl !== null && !imageFailed ? (
        <img src={imageUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <span className="tile-image-placeholder muted">No image</span>
      )}
    </div>
  );
}