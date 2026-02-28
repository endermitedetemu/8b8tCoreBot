const fs = require("fs");
const path = require("path");

class LogsManager {
    constructor() {
        this.logsFile = path.join(__dirname, "..", "data", "coords_logs.json");
        this.checkpointFile = path.join(
            __dirname,
            "..",
            "data",
            "logs_checkpoint.json",
        );
        this.dataDir = path.join(__dirname, "..", "data");
        this.logs = {};
        this.checkpoint = { lastMessageId: null };

        this.ensureDataDir();
        this.load();
        this.loadCheckpoint();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    load() {
        try {
            if (fs.existsSync(this.logsFile)) {
                const data = fs.readFileSync(this.logsFile, "utf8");
                this.logs = JSON.parse(data);
                console.log(
                    `Logs cargados: ${Object.keys(this.logs).length} usuarios`,
                );
            } else {
                this.logs = {};
                this.save();
            }
        } catch (error) {
            console.error("Error al cargar logs:", error);
            this.logs = {};
        }
    }

    save() {
        try {
            fs.writeFileSync(this.logsFile, JSON.stringify(this.logs, null, 2));
        } catch (error) {
            console.error("Error al guardar logs:", error);
        }
    }

    loadCheckpoint() {
        try {
            if (fs.existsSync(this.checkpointFile)) {
                const data = fs.readFileSync(this.checkpointFile, "utf8");
                this.checkpoint = JSON.parse(data);
                console.log(
                    `Checkpoint: ${this.checkpoint.lastMessageId || "ninguno"}`,
                );
            }
        } catch (error) {
            console.error("Error al cargar checkpoint:", error);
        }
    }

    saveCheckpoint(messageId) {
        try {
            this.checkpoint.lastMessageId = messageId;
            fs.writeFileSync(
                this.checkpointFile,
                JSON.stringify(this.checkpoint, null, 2),
            );
        } catch (error) {
            console.error("Error al guardar checkpoint:", error);
        }
    }

    addLog(username, x, y, z, dimension, timestamp) {
        username = username.toLowerCase();

        // Filtrar coordenadas cercanas al spawn (menos de 40k)
        if (Math.abs(x) < 40000 && Math.abs(z) < 40000) {
            return false;
        }

        if (!this.logs[username]) {
            this.logs[username] = [];
        }

        // ARREGLO: Deduplicar por distancia mínima de 2000 bloques en cualquier dirección
        const MIN_DISTANCE = 2000;
        const tooClose = this.logs[username].some((log) => {
            if (log.dimension !== dimension) return false;
            const dx = Math.abs(log.x - x);
            const dz = Math.abs(log.z - z);
            // Si en X O en Z está a menos de 2000 bloques, es "muy cercano"
            return dx < MIN_DISTANCE && dz < MIN_DISTANCE;
        });

        if (tooClose) {
            return false;
        }

        this.logs[username].push({
            x: Math.round(x),
            y: Math.round(y),
            z: Math.round(z),
            dimension,
            timestamp,
        });

        this.save();
        return true;
    }

    getUserLogs(username) {
        username = username.toLowerCase();
        return this.logs[username] || [];
    }

    getAllUsers() {
        return Object.keys(this.logs).sort();
    }

    // Limpia logs duplicados/cercanos del usuario (para limpiar datos existentes)
    cleanUserLogs(username) {
        username = username.toLowerCase();
        if (!this.logs[username]) return 0;

        const original = this.logs[username].length;
        const MIN_DISTANCE = 2000;
        const cleaned = [];

        for (const log of this.logs[username]) {
            const tooClose = cleaned.some((existing) => {
                if (existing.dimension !== log.dimension) return false;
                return (
                    Math.abs(existing.x - log.x) < MIN_DISTANCE &&
                    Math.abs(existing.z - log.z) < MIN_DISTANCE
                );
            });
            if (!tooClose) cleaned.push(log);
        }

        this.logs[username] = cleaned;
        const removed = original - cleaned.length;
        if (removed > 0) this.save();
        return removed;
    }

    // Limpia todos los logs de todos los usuarios
    cleanAllLogs() {
        let totalRemoved = 0;
        for (const user of Object.keys(this.logs)) {
            totalRemoved += this.cleanUserLogs(user);
        }
        return totalRemoved;
    }

    parseLogEmbed(embed) {
        try {
            const description = embed.description || "";
            const lines = description
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

            let username = null;
            let coords = null;
            let dimension = null;
            let timestamp = null;

            for (const line of lines) {
                if (line.startsWith("USER:")) {
                    const match = line.match(/USER:\s*(\w+)/i);
                    if (match) username = match[1];
                }
                if (line.startsWith("COORDS:")) {
                    const match = line.match(
                        /COORDS:\s*([-\d]+),\s*([-\d]+),\s*([-\d]+)/i,
                    );
                    if (match)
                        coords = {
                            x: parseInt(match[1]),
                            y: parseInt(match[2]),
                            z: parseInt(match[3]),
                        };
                }
                if (line.startsWith("DIMENSION:")) {
                    const match = line.match(/DIMENSION:\s*(\w+)/i);
                    if (match) dimension = match[1];
                }
                if (line.startsWith("TIMESTAMP:")) {
                    const match = line.match(/TIMESTAMP:\s*(.+)/i);
                    if (match) timestamp = match[1].trim();
                }
            }

            if (!username || !coords) return null;
            return {
                username,
                x: coords.x,
                y: coords.y,
                z: coords.z,
                dimension: dimension || "UNKNOWN",
                timestamp: timestamp || new Date().toISOString(),
            };
        } catch (error) {
            return null;
        }
    }

    async scanChannelBackwards(channel, limit = 10000) {
        let messagesProcessed = 0;
        let logsAdded = 0;
        let oldestMessageId = null;
        let newestMessageId = null;

        console.log("Escaneando desde el mensaje mas reciente hacia atras...");

        try {
            let batchCount = 0;
            let hasMore = true;

            while (hasMore && messagesProcessed < limit) {
                batchCount++;
                let fetchOptions = { limit: 100 };
                if (oldestMessageId) fetchOptions.before = oldestMessageId;

                const messages = await channel.messages.fetch(fetchOptions);
                if (messages.size === 0) {
                    hasMore = false;
                    break;
                }

                console.log(`Batch ${batchCount}: ${messages.size} mensajes`);
                const sortedMessages = Array.from(messages.values()).sort(
                    (a, b) => b.createdTimestamp - a.createdTimestamp,
                );

                for (const message of sortedMessages) {
                    messagesProcessed++;
                    if (!newestMessageId) newestMessageId = message.id;
                    oldestMessageId = message.id;

                    if (message.embeds && message.embeds.length > 0) {
                        for (const embed of message.embeds) {
                            const parsedLog = this.parseLogEmbed(embed);
                            if (parsedLog) {
                                const added = this.addLog(
                                    parsedLog.username,
                                    parsedLog.x,
                                    parsedLog.y,
                                    parsedLog.z,
                                    parsedLog.dimension,
                                    parsedLog.timestamp,
                                );
                                if (added) {
                                    logsAdded++;
                                    if (logsAdded % 10 === 0)
                                        console.log(
                                            `${logsAdded} logs añadidos...`,
                                        );
                                }
                            }
                        }
                    }
                }

                if (messages.size < 100) hasMore = false;
                if (messagesProcessed % 500 === 0)
                    console.log(`Progreso: ${messagesProcessed} mensajes`);
            }

            if (newestMessageId) {
                this.saveCheckpoint(newestMessageId);
                console.log(`Checkpoint guardado: ${newestMessageId}`);
            }

            return { messagesProcessed, logsAdded };
        } catch (error) {
            console.error("Error al escanear:", error);
            return { messagesProcessed, logsAdded, error: error.message };
        }
    }

    async scanChannelForward(channel, limit = 1000) {
        let messagesProcessed = 0;
        let logsAdded = 0;
        const lastCheckpoint = this.checkpoint.lastMessageId;
        if (!lastCheckpoint) return { messagesProcessed: 0, logsAdded: 0 };

        try {
            let currentMessageId = lastCheckpoint;
            let hasMore = true;
            let newestMessageId = lastCheckpoint;

            while (hasMore && messagesProcessed < limit) {
                const messages = await channel.messages.fetch({
                    limit: 100,
                    after: currentMessageId,
                });
                if (messages.size === 0) {
                    hasMore = false;
                    break;
                }

                const sortedMessages = Array.from(messages.values()).sort(
                    (a, b) => a.createdTimestamp - b.createdTimestamp,
                );

                for (const message of sortedMessages) {
                    messagesProcessed++;
                    newestMessageId = message.id;

                    if (message.embeds && message.embeds.length > 0) {
                        for (const embed of message.embeds) {
                            const parsedLog = this.parseLogEmbed(embed);
                            if (parsedLog) {
                                const added = this.addLog(
                                    parsedLog.username,
                                    parsedLog.x,
                                    parsedLog.y,
                                    parsedLog.z,
                                    parsedLog.dimension,
                                    parsedLog.timestamp,
                                );
                                if (added) logsAdded++;
                            }
                        }
                    }
                }

                currentMessageId = newestMessageId;
                if (messages.size < 100) hasMore = false;
            }

            if (newestMessageId !== lastCheckpoint)
                this.saveCheckpoint(newestMessageId);
            return { messagesProcessed, logsAdded };
        } catch (error) {
            console.error("Error en escaneo forward:", error);
            return { messagesProcessed, logsAdded, error: error.message };
        }
    }
}

module.exports = LogsManager;
