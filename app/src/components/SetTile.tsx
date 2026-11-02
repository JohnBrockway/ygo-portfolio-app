import { useState } from "react";
import { Link } from "react-router-dom";
import { setImageUrl } from "../data/images";
import type { CardSet } from "../data/types";

export function SetTile({ set }: { set: CardSet }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = setImageUrl(set);

  return (
    <Link to={`/sets/${set.set_id}`} className="tile" title={set.title}>
      <div className="tile-image">
        {imageUrl !== null && !imageFailed ? (
          <img src={imageUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span className="tile-image-placeholder muted">No image</span>
        )}
      </div>
      <div className="tile-body">
        <div className="tile-title">{set.title}</div>
        <div className="tile-meta">
          <span className="tag">{set.region}</span>
        </div>
      </div>
    </Link>
  );
}