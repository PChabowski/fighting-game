// Utilities for display scaling and vertical alignment
// Compute display scale based on a canvas dimension (width or height) and a default reference.
// For vertical alignment we pass canvas height and DEFAULT_HEIGHT so vertical scaling matches.
export function computeDisplayScale(canvasSize, defaultSize = 1024) {
  return canvasSize / defaultSize;
}

export function scaleFighter(fighter, displayScale, canvasHeight, defaultHeight = 576) {
  if (!fighter) return;
  if (typeof displayScale !== 'number' || displayScale <= 0) return;
  // scale base position horizontally and offsets
  if (fighter.basePosition) {
    fighter.position.x = (fighter.basePosition.x || 0) * displayScale;
  }
  if (fighter.baseOffset) {
    fighter.offset.x = (fighter.baseOffset.x || 0) * displayScale;
    fighter.offset.y = (fighter.baseOffset.y || 0) * displayScale;
  }
  if (fighter.baseAttackBoxOffset) {
    fighter.attackBox.offset.x = (fighter.baseAttackBoxOffset.x || 0) * displayScale;
    fighter.attackBox.offset.y = (fighter.baseAttackBoxOffset.y || 0) * displayScale;
  }
  fighter.width = (fighter.baseWidth || fighter.width) * displayScale;
  fighter.height = (fighter.baseHeight || fighter.height) * displayScale;
  fighter.scale = (fighter.baseScale || fighter.scale) * displayScale;

  // Vertical placement: align to the same ground line as the shop/background.
  // Compute ground Y in default coordinate then scale it to current canvasHeight.
  if (canvasHeight) {
    const groundOffset = 96; // same offset used elsewhere
    const groundDefaultY = defaultHeight - groundOffset;
    const scaledGroundY = Math.round((groundDefaultY * canvasHeight) / defaultHeight);
    // place fighter so its bottom (position.y + height) equals scaledGroundY
    fighter.position.y = scaledGroundY - (fighter.height || 0);
  }
}

export function alignSpriteToGround(sprite, canvasHeight, groundOffset = 96) {
  if (!sprite || !canvasHeight) return;
  const groundY = canvasHeight - groundOffset;

  const tryAlign = () => {
    const img = sprite.image;
    const imgH = (img && (img.naturalHeight || img.height)) || 0;
    const scaledH = imgH * (sprite.scale || 1);
    const offsetY = (sprite.offset && sprite.offset.y) || 0;
    // position.y is used so that draw uses (position.y - offset.y) as the top of sprite
    sprite.position.y = Math.round(groundY + offsetY - scaledH);
  };

  const img = sprite.image;
  if (img && img.complete && (img.naturalHeight || img.height)) {
    tryAlign();
  } else if (img) {
    img.addEventListener('load', tryAlign, { once: true });
  } else {
    // fallback: use sprite.height if available
    sprite.position.y = groundY - (sprite.height || 0);
  }
}

export function scaleShop(shop, displayScale, defaultHeight = 576) {
  if (!shop) return;
  if (shop.basePosition) {
    shop.position.x = (shop.basePosition.x || 0) * displayScale;
    const vertRatio = (shop.basePosition.y || 0) / defaultHeight;
    shop.position.y = Math.round(vertRatio * (shop.canvasHeight || defaultHeight));
  }
  if (typeof shop.baseScale === 'number') shop.scale = shop.baseScale * displayScale;
}
