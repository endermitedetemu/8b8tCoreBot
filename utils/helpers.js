function extraerMensaje(msg) {
  const regexWithRole = /^\[[^\]]+\] <[^>]+> (.+)$/;
  const regexWithoutRole = /^<[^>]+> (.+)$/;
  const regexSystem = /^\[[^\]]+\] (.+)$/;
  let match;
  match = msg.match(regexWithRole);
  if (match) return match[1];
  match = msg.match(regexWithoutRole);
  if (match) return match[1];
  match = msg.match(regexSystem);
  if (match) return match[1];
  return null;
}

function extraerUsername(msg) {
  const regexWithRole = /^\[[^\]]+\] <([^>]+)>/;
  const regexWithoutRole = /^<([^>]+)> /;
  const regexSystem = /^\[([^>]+)\]/;
  let match;
  match = msg.match(regexWithRole);
  if (match) return match[1];
  match = msg.match(regexWithoutRole);
  if (match) return match[1];
  match = msg.match(regexSystem);
  if (match) return match[1];
  return null;
}

function getRealUsername(bot, displayname) {
  if (displayname == null) return null;
  if (!bot || !bot.players) return null;
  for (let player in bot.players) {
    const playerInfo = bot.players[player];
    if (playerInfo && playerInfo.displayName) {
      const currentDisplayName = playerInfo.displayName.toString();
      const usernameLimpio = (currentDisplayName.match(/(?:\[\S+\]\s*)?(.*)/) || [])[1] || null;
      if (usernameLimpio == displayname) return playerInfo.username;
    }
  }
  for (let player in bot.players) {
    const playerInfo = bot.players[player];
    const cleanedDisplayname = displayname.startsWith('.') ? displayname.substring(1) : displayname;
    if (playerInfo && (displayname === playerInfo.username || cleanedDisplayname === playerInfo.username)) {
      return playerInfo.username;
    }
  }
  if (displayname === "8b8tCore" || displayname === "8b8t") return displayname;
  return null;
}

function replaceLinks(text) {
  if (text.includes("8b8t.me")) return text;
  const urlPattern = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
  return text.replace(urlPattern, '`[link omitido]`');
}

function dividirMensaje(mensaje, maxLength) {
  let partes = [];
  let palabras = mensaje.split(" ");
  let mensajeActual = "";
  for (let palabra of palabras) {
    if ((mensajeActual + palabra).length > maxLength) {
      partes.push(mensajeActual.trim());
      mensajeActual = "";
    }
    mensajeActual += palabra + " ";
  }
  if (mensajeActual.trim().length > 0) partes.push(mensajeActual.trim());
  return partes;
}

module.exports = {
  extraerMensaje,
  extraerUsername,
  getRealUsername,
  replaceLinks,
  dividirMensaje
};
