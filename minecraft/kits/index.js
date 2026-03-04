const fs   = require('fs');
const path = require('path');
const config = require('../../config');

const KIT_USERS_PATH = path.join(__dirname, '../kit_users.json');

const KITS = [
  { trigger: 'refill', home: '/home refill'      },
  { trigger: 'fuerza', home: '/home fuerza' },
  { trigger: 'travel', home: '/home anchor' },

];

function loadKitUsers() {
  try {
    return JSON.parse(fs.readFileSync(KIT_USERS_PATH, 'utf8')).users || [];
  } catch {
    return [];
  }
}

function saveKitUsers(users) {
  fs.writeFileSync(KIT_USERS_PATH, JSON.stringify({ users }, null, 2), 'utf8');
}

function isKitAllowed(username) {
  const fromConfig = [
    ...config.permissions.admin,
    ...config.permissions.moderator,
    ...config.permissions.special,
  ];
  return fromConfig.includes(username) || loadKitUsers().includes(username);
}

const KIT_MANAGERS = ['htp1p0', 'kutuzovs'];

async function handleKit(msgLower, bot, username, setWaiting) {
  const kit = KITS.find(k => k.trigger === msgLower);
  if (!kit) return false;

  if (isKitAllowed(username)) {
    bot.chat(kit.home);
    setTimeout(() => {
      setWaiting(true);
      bot.chat(`/tpa ${username}`);
    }, 1000);
  }
  return true;
}

function handleKitsCommand(username, args) {
  if (!KIT_MANAGERS.includes(username)) return 'No tienes permiso para usar esto';
  if (args.length < 1) return 'Uso: !kits <add|remove|list> [usuario]';

  const action = args[0].toLowerCase();
  const target = args[1];

  if (action === 'list') {
    const users = loadKitUsers();
    return users.length === 0
      ? 'Sin usuarios extra de kits.'
      : `Kits extra: ${users.join(', ')}`;
  }
  if (action === 'add') {
    if (!target) return 'Uso: !kits add <usuario>';
    const users = loadKitUsers();
    if (users.includes(target)) return `${target} ya tiene acceso`;
    users.push(target);
    saveKitUsers(users);
    return `${target} añadido a kits`;
  }
  if (action === 'remove') {
    if (!target) return 'Uso: !kits remove <usuario>';
    let users = loadKitUsers();
    if (!users.includes(target)) return `${target} no esta en la lista`;
    users = users.filter(u => u !== target);
    saveKitUsers(users);
    return `${target} eliminado de kits`;
  }
  return 'Accion invalida. Usa: add, remove o list';
}

function getKitTriggers() {
  return KITS.map(k => k.trigger);
}

module.exports = { handleKit, handleKitsCommand, isKitAllowed, getKitTriggers };