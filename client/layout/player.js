export default function Player(data)  {
    const classes = ["player", `avatar-${data.avatarColor}`];
    if (data.his.isLocal) classes.push("local-player");
    if (data.dead) classes.push("dead-player");
    if (data.hasDamageFlash) classes.push("damage-flash");

    return new VNode("div", {
      id: `player-${data.playerId}`,
      class: classes.join(" "),
      style: `
        position:absolute;
        width:${GameConstants.TILE_SIZE}px;
        height:${GameConstants.TILE_SIZE}px;
        left:${data.position.x}px;
        top:${data.position.y}px;
        background-image:url('${data.sprites[data.direction]}');
        background-size:auto ${GameConstants.TILE_SIZE}px;
        background-position:-${data.frameIndex * GameConstants.TILE_SIZE}px 0px;
      `
    });
}