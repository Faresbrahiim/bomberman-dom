// Here we keep map, player, bombs, etc.
// For now: simple placeholder with a "player"

export function createMap(container) {
  // Map grid
  const map = document.createElement("div");
  map.style.display = "grid";
  map.style.gridTemplateColumns = "repeat(10, 30px)";
  map.style.gridTemplateRows = "repeat(10, 30px)";
  map.style.gap = "2px";

  // Fill map with empty tiles
  for (let i = 0; i < 100; i++) {
    const tile = document.createElement("div");
    tile.style.width = "30px";
    tile.style.height = "30px";
    tile.style.background = "#eee";
    map.appendChild(tile);
  }

  // Add a player (for demo)
  const player = document.createElement("div");
  player.textContent = "🙂";
  player.style.gridColumn = "1";
  player.style.gridRow = "1";
  map.appendChild(player);

  container.appendChild(map);
}
