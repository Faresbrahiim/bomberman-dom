import { VNode } from "../framework/vdom.js";
import { GameConstants } from "./constant.js";

export class GameUI {
  renderPlayersStatus(players) {
    return new VNode("div", { class: "players-container" },
      Array.from(players.entries()).map(([playerId, player]) =>
        this.createPlayerCard(player, playerId)
      )
    );
  }
 updateAllPlayersStatus(players) {
    return this.renderPlayersStatus(players);
  }

  createPlayerCard(player, playerId) {
    const classes = ["player-card"];
    if (player.isLocal) classes.push("local-player");
    if (player.lives <= 0) classes.push("eliminated");

    return new VNode("div", { class: classes.join(" ") }, [
      // header
      new VNode("div", { class: "player-header" }, [
        new VNode("div", { class: `player-avatar player-${playerId}` }, [`P${playerId}`]),
        new VNode("div", { class: "player-name" }, [player.nickname || `Player ${playerId}`]),
        player.isLocal ? new VNode("div", { class: "local-badge" }, ["You"]) : null
      ]),
      // stats
      new VNode("div", { class: "stats-container" }, [
        this.createLivesStat(player.lives),
        this.createStatItem("💣", "Bombs", player.powerups.bombs, "powerup-bombs"),
        this.createStatItem("🔥", "Flames", player.powerups.flames, "powerup-flames"),
        this.createStatItem("⚡", "Speed", player.powerups.speed, "powerup-speed"),
      ])
    ]);
  }

  createLivesStat(lives) {
    const maxLives = Math.max(3, lives);
    return new VNode("div", { class: "stat-item lives-container" }, [
      new VNode("div", {}, [
        new VNode("span", { class: "stat-icon" }, ["❤️"]),
        new VNode("span", { class: "stat-label" }, ["Lives"])
      ]),
      new VNode("div", { class: "lives-hearts" },
        Array.from({ length: maxLives }).map((_, i) =>
          new VNode("span", { class: i < lives ? "heart" : "heart empty" }, ["♥"])
        )
      )
    ]);
  }

  createStatItem(icon, label, value, additionalClass = '') {
    return new VNode("div", { class: `stat-item ${additionalClass}` }, [
      new VNode("div", {}, [
        new VNode("span", { class: "stat-icon" }, [icon]),
        new VNode("span", { class: "stat-label" }, [label])
      ]),
      new VNode("span", { class: "stat-value" }, [String(value)])
    ]);
  }

  renderMap(map, width, height, hiddenPowerups) {
    return new VNode("div", {
      id: "map",
      style: `
        display:grid;
        grid-template-columns:repeat(${width}, ${GameConstants.TILE_SIZE}px);
        grid-template-rows:repeat(${height}, ${GameConstants.TILE_SIZE}px);
        gap:0;
        position:relative;
      `
    }, 
      map.flatMap((row, y) =>
        row.map((cell, x) => this.createMapCell(cell, x, y, hiddenPowerups))
      )
    );
  }

  createMapCell(cellType, x, y, hiddenPowerups) {
    const classes = ["cell"];
    switch (cellType) {
      case GameConstants.CELL_TYPES.EMPTY: classes.push("empty"); break;
      case GameConstants.CELL_TYPES.WALL: classes.push("wall"); break;
      case GameConstants.CELL_TYPES.DESTRUCTIBLE:
        classes.push("destructible");
        if (hiddenPowerups.has(`${x},${y}`)) classes.push("has-powerup");
        break;
      case GameConstants.CELL_TYPES.PLAYER_SPAWN: classes.push("player-spawn"); break;
      case GameConstants.CELL_TYPES.BOMB_POWERUP: classes.push("bomb-powerup"); break;
      case GameConstants.CELL_TYPES.FLAME_POWERUP: classes.push("flame-powerup"); break;
      case GameConstants.CELL_TYPES.SPEED_POWERUP: classes.push("speed-powerup"); break;
      case GameConstants.CELL_TYPES.BOMB: classes.push("bomb"); break;
    }
    return new VNode("div", {
      class: classes.join(" "),
      "data-x": x,
      "data-y": y,
      style: `width:${GameConstants.TILE_SIZE}px;height:${GameConstants.TILE_SIZE}px;`
    });
  }
}
