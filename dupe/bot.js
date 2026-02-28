const fs = require("fs");
const path = require("path");
const config = require("../config");
const CONFIG_PATH = path.join(__dirname, "../config.js");

let dupeActive = false;
let dupeEnabled = true;
let dupeInterval = null;
let pendingConfirmation = {};
let currentDupeUser = null;

const isShulker = (item) => item && item.name && item.name.includes("shulker");

function isAdmin(username) {
    return config.permissions.admin.includes(username);
}

function isOperator(username) {
    return (
        config.permissions.admin.includes(username) ||
        config.permissions.moderator.includes(username) ||
        config.permissions.special.includes(username)
    );
}

function hasAccess(username) {
    return (
        isOperator(username) ||
        (config.permissions.private || []).includes(username)
    );
}

function addPrivateUser(username) {
    if (!config.permissions.private) config.permissions.private = [];
    if (config.permissions.private.includes(username)) return false;
    config.permissions.private.push(username);
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const updated = raw.replace(/private:\s*\[([^\]]*)\]/, (match, inner) => {
        const current = inner
            .split(",")
            .map((s) => s.trim().replace(/'/g, ""))
            .filter(Boolean);
        current.push(username);
        return "private: ['" + current.join("', '") + "']";
    });
    fs.writeFileSync(CONFIG_PATH, updated, "utf8");
    return true;
}

async function getShulkerInHand(bot) {
    // Buscar shulker en hotbar primero, si no en inventario completo y moverla
    const allItems = bot.inventory.items();
    const hotbarShulker = allItems.find(
        (item) => isShulker(item) && item.slot >= 36 && item.slot <= 44,
    );
    let shulker = hotbarShulker;

    if (!shulker) {
        const anyShulker = allItems.find((item) => isShulker(item));
        if (!anyShulker) return null;

        // Mover a slot libre de hotbar
        const hotbarSlots = Array.from({ length: 9 }, (_, i) => 36 + i);
        const occupiedHotbar = new Set(
            allItems
                .filter((i) => i.slot >= 36 && i.slot <= 44)
                .map((i) => i.slot),
        );
        const freeSlot = hotbarSlots.find((s) => !occupiedHotbar.has(s));
        if (freeSlot !== undefined) {
            try {
                await bot.moveSlotItem(anyShulker.slot, freeSlot);
                shulker =
                    bot.inventory
                        .items()
                        .find(
                            (item) => isShulker(item) && item.slot === freeSlot,
                        ) || anyShulker;
            } catch (e) {
                shulker = anyShulker;
            }
        } else {
            shulker = anyShulker;
        }
    }

    // Equipar en mano
    try {
        await Promise.race([
            bot.equip(shulker, "hand"),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 3000),
            ),
        ]);
        return true;
    } catch (e) {
        return null;
    }
}

async function startDupe(bot, username) {
    if (!dupeEnabled) return null;
    if (dupeActive) return "El dupe ya esta activo.";

    const pos = bot.entity.position;
    let frameEntity = null;
    let frameDirection = null;

    for (const id in bot.entities) {
        const entity = bot.entities[id];
        if (
            entity.name === "item_frame" ||
            entity.name === "ItemFrame" ||
            (entity.displayName && entity.displayName === "Item Frame")
        ) {
            const dx = entity.position.x - pos.x;
            const dy = entity.position.y - pos.y;
            const dz = entity.position.z - pos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist <= 3) {
                frameEntity = entity;
                frameDirection = { x: dx, y: dy, z: dz };
                break;
            }
        }
    }

    if (!frameEntity) {
        bot.chat(
            "/w " +
                username +
                " Lo siento, no encontre un marco a mi alrededor.",
        );
        return null;
    }

    // Verificar que hay shulkers
    if (!bot.inventory.items().find((item) => isShulker(item))) {
        bot.chat("/w " + username + " No tengo shulkers en el inventario.");
        return null;
    }

    const frameHasItem =
        frameEntity.metadata &&
        frameEntity.metadata.some(
            (m) =>
                m &&
                typeof m === "object" &&
                m.itemCount !== undefined &&
                m.itemCount > 0,
        );

    if (frameHasItem) {
        pendingConfirmation[username] = { frameEntity, frameDirection };
        bot.chat(
            "/w " +
                username +
                ' Hay un item en el marco. Quieres continuar de todas formas? Responde "si" o "no".',
        );
        return null;
    }

    return await executeDupe(bot, username, frameEntity, frameDirection);
}

async function executeDupe(bot, username, frameEntity, frameDirection) {
    dupeActive = true;
    currentDupeUser = username;

    // Mirar al marco
    const yaw = Math.atan2(-frameDirection.x, -frameDirection.z);
    const pitch = Math.atan2(
        -frameDirection.y,
        Math.sqrt(
            frameDirection.x * frameDirection.x +
                frameDirection.z * frameDirection.z,
        ),
    );
    bot.look(yaw, pitch, true);

    // Equipar primera shulker
    const ok = await getShulkerInHand(bot);
    if (!ok) {
        dupeActive = false;
        currentDupeUser = null;
        bot.chat("/w " + username + " No pude equipar la shulker.");
        return null;
    }

    // Ciclo cada 1 segundo: poner shulker → 500ms → quitar → buscar siguiente shulker
    dupeInterval = setInterval(async () => {
        if (!dupeActive) {
            clearInterval(dupeInterval);
            dupeInterval = null;
            return;
        }

        // Buscar shulker en mano o equipar una nueva
        const held = bot.inventory.slots[bot.getEquipmentDestSlot("hand")];
        if (!held || !isShulker(held)) {
            const ready = await getShulkerInHand(bot);
            if (!ready) {
                // Sin shulkers, detener
                dupeActive = false;
                currentDupeUser = null;
                clearInterval(dupeInterval);
                dupeInterval = null;
                bot.chat(
                    "/w " +
                        username +
                        " Se acabaron las shulkers. Dupe detenido.",
                );
                return;
            }
        }

        // Poner shulker en marco (click derecho)
        try {
            bot.activateEntity(frameEntity);
        } catch (e) {}

        // Esperar 500ms y quitar (click izquierdo)
        setTimeout(() => {
            if (!dupeActive) return;
            try {
                bot.attack(frameEntity);
            } catch (e) {}
        }, 500);
    }, 1000);

    return "Dupe iniciado. Usa !dupeoff para detener.";
}

async function handleConfirmation(bot, username, message) {
    if (!pendingConfirmation[username]) return false;
    const r = message.trim().toLowerCase();
    if (r !== "si" && r !== "no") return false;

    const { frameEntity, frameDirection } = pendingConfirmation[username];
    delete pendingConfirmation[username];

    if (r === "si") {
        const result = await executeDupe(
            bot,
            username,
            frameEntity,
            frameDirection,
        );
        if (result) bot.chat("/w " + username + " " + result);
    } else {
        bot.chat("/w " + username + " Dupe cancelado.");
    }
    return true;
}

function stopDupe(bot, username) {
    if (!dupeActive) return "No hay dupe activo.";
    dupeActive = false;
    currentDupeUser = null;
    if (dupeInterval) {
        clearInterval(dupeInterval);
        dupeInterval = null;
    }
    return "Dupe detenido.";
}

function setDupeEnabled(value) {
    dupeEnabled = value;
    if (!value && dupeActive) {
        dupeActive = false;
        currentDupeUser = null;
        if (dupeInterval) {
            clearInterval(dupeInterval);
            dupeInterval = null;
        }
    }
}

function getDupeEnabled() {
    return dupeEnabled;
}
function isDupeActive() {
    return dupeActive;
}

async function handleDupeCommand(command, bot, username, message) {
    const cmd = command.trim().toLowerCase();

    // !dupe on/off (solo admins)
    if (cmd === "!dupe on" || cmd === "!dupe off") {
        if (!isAdmin(username)) return false;
        const enable = cmd === "!dupe on";
        setDupeEnabled(enable);
        bot.chat(
            "/w " +
                username +
                " Frame Dupe " +
                (enable ? "ACTIVADO." : "DESACTIVADO."),
        );
        return true;
    }

    // !dpsprivate <mcuser> (solo admins)
    const privateMatch = cmd.match(/^!dpsprivate\s+(\S+)$/);
    if (privateMatch) {
        if (!isAdmin(username)) return false;
        const target = privateMatch[1];
        const added = addPrivateUser(target);
        if (added) {
            bot.chat(
                "/w " +
                    target +
                    " Has sido añadido a la lista para usar el frame dupe de DPS_Voyager_bot by htp1p0.",
            );
            bot.chat(
                "/w " +
                    username +
                    " " +
                    target +
                    " ahora tiene acceso al frame dupe.",
            );
        } else {
            bot.chat(
                "/w " + username + " " + target + " ya estaba en la lista.",
            );
        }
        return true;
    }

    // Solo operadores o lista privada desde aqui
    if (!hasAccess(username)) return false;

    // !tpa
    if (cmd === "!tpa") {
        if (
            dupeActive &&
            currentDupeUser &&
            currentDupeUser !== username &&
            !isOperator(username)
        ) {
            bot.chat(
                "/w " +
                    username +
                    " Lo siento, espera a que termine de usarme " +
                    currentDupeUser +
                    ".",
            );
            return true;
        }
        bot.chat("/tpa " + username);
        return true;
    }

    // Bloqueo sesion activa para privados
    const protectedCmds = ["!dupeon", "!dupeoff", "!drop"];
    if (protectedCmds.includes(cmd)) {
        if (
            dupeActive &&
            currentDupeUser &&
            currentDupeUser !== username &&
            !isOperator(username)
        ) {
            bot.chat(
                "/w " +
                    username +
                    " Lo siento, ahora mismo estoy duplicando con " +
                    currentDupeUser +
                    ". Cuando termine ire contigo.",
            );
            return true;
        }
    }

    // !drop — para el dupe y hace /kill
    if (cmd === "!drop") {
        if (dupeActive) stopDupe(bot, username);
        bot.chat("/kill");
        return true;
    }

    if (!dupeEnabled) return false;

    // Confirmacion pendiente
    if (pendingConfirmation[username]) {
        return await handleConfirmation(bot, username, message || command);
    }

    if (cmd === "!dupeon") {
        const result = await startDupe(bot, username);
        if (result) bot.chat("/w " + username + " " + result);
        return true;
    }

    if (cmd === "!dupeoff") {
        const result = stopDupe(bot, username);
        bot.chat("/w " + username + " " + result);
        return true;
    }

    return false;
}

module.exports = {
    handleDupeCommand,
    isDupeActive,
    stopDupe,
    setDupeEnabled,
    getDupeEnabled,
};
