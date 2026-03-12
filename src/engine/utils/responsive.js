/**
 * Funkcja zapewniająca poprawne skalowanie gry na mobile
 * bez psuciu hitboxów i fizyki.
 */
export function initResponsiveCanvas(canvas) {
  const internalWidth = 1024;
  const internalHeight = 576;

  function resize() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowRatio = windowWidth / windowHeight;
    const gameRatio = internalWidth / internalHeight;

    // Skalowanie CSS (nie zmienia rozdzielczości logicznej canvasu)
    if (windowRatio > gameRatio) {
      canvas.style.width = `${windowHeight * gameRatio}px`;
      canvas.style.height = `${windowHeight}px`;
    } else {
      canvas.style.width = `${windowWidth}px`;
      canvas.style.height = `${windowWidth / gameRatio}px`;
    }
  }

  // Ustawiamy stałą rozdzielczość wewnętrzną
  canvas.width = internalWidth;
  canvas.height = internalHeight;

  window.addEventListener('resize', resize);
  resize();
}
