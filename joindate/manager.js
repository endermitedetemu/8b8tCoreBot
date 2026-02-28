const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const DATA_FILE = path.join(__dirname, "joindate_data.json");
const SCRIPT_FILE = path.join(__dirname, "generate_pdfs.py");
const PDF_PLAYERS = path.join(__dirname, "8b8t_players.pdf");
const PDF_METRICS = path.join(__dirname, "8b8t_metrics.pdf");
const PDF_GRAPHS  = path.join(__dirname, "8b8t_graphs.pdf");

class JoindateManager {
    constructor() {
        this.data = { players: {}, peak_online: 0, whitelist: [], blacklist: [] };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                this.data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
                if (!this.data.players)    this.data.players    = {};
                if (!this.data.peak_online) this.data.peak_online = 0;
                if (!this.data.whitelist)  this.data.whitelist  = [];
                if (!this.data.blacklist)  this.data.blacklist  = [];
                console.log(`[Joindate] Cargados ${Object.keys(this.data.players).length} jugadores`);
            }
        } catch (e) {
            console.error("[Joindate] Error al cargar:", e.message);
        }
    }

    save() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error("[Joindate] Error al guardar:", e.message);
        }
    }

    isWhitelisted(username) {
        return this.data.whitelist.includes(username.toLowerCase());
    }

    addPlayer(username, joinDateStr) {
        const key = username.toLowerCase();
        if (this.isWhitelisted(key)) return false;

        let parsedDate = null;
        try {
            const d = new Date(joinDateStr);
            if (!isNaN(d.getTime())) parsedDate = d.toISOString().split("T")[0];
        } catch (e) {}
        if (!parsedDate) parsedDate = joinDateStr;

        this.data.players[key] = parsedDate;
        this.data.whitelist.push(key);
        this.save();
        console.log(`[Joindate] Guardado: ${username} → ${parsedDate}`);
        return true;
    }

    addPlayerManual(username, joinDateStr) {
        const key = username.toLowerCase();
        if (joinDateStr) return this.addPlayer(username, joinDateStr);
        if (!this.data.players[key]) {
            this.data.players[key] = null;
            this.save();
        }
        return true;
    }

    updatePeak(currentOnline) {
        if (currentOnline > this.data.peak_online) {
            this.data.peak_online = currentOnline;
            this.save();
        }
    }

    getPlayersToQuery(botPlayers) {
        return Object.keys(botPlayers).filter(p => !this.isWhitelisted(p.toLowerCase()));
    }

    addToBlacklist(username) {
        const key = username.toLowerCase();
        if (!this.data.blacklist) this.data.blacklist = [];
        if (this.data.blacklist.includes(key)) return false;
        this.data.blacklist.push(key);
        this.save();
        console.log(`[Joindate] Blacklist: ${username} añadido`);
        return true;
    }

    isBlacklisted(username) {
        return (this.data.blacklist || []).includes(username.toLowerCase());
    }

    getBlacklist() {
        return this.data.blacklist || [];
    }

    generatePDFs() {
        return new Promise((resolve, reject) => {
            const { execSync } = require("child_process");
            const venvPython = path.join(__dirname, "venv", "bin", "python3");

            if (!fs.existsSync(venvPython)) {
                console.log("[Joindate] Creando venv e instalando reportlab...");
                try {
                    execSync(`python3 -m venv "${path.join(__dirname, "venv")}"`, { stdio: "inherit" });
                    execSync(`"${venvPython}" -m pip install reportlab -q`, { stdio: "inherit" });
                    console.log("[Joindate] venv listo.");
                } catch (e) {
                    return reject(new Error("No se pudo crear el venv: " + e.message));
                }
            }

            execFile(venvPython, [SCRIPT_FILE], (err, stdout, stderr) => {
                if (err) {
                    console.error("[Joindate] Error generando PDFs:", stderr);
                    reject(err);
                } else {
                    console.log("[Joindate] PDFs generados");
                    resolve({ players: PDF_PLAYERS, metrics: PDF_METRICS, graphs: PDF_GRAPHS });
                }
            });
        });
    }

    getPDFPaths() {
        return { players: PDF_PLAYERS, metrics: PDF_METRICS, graphs: PDF_GRAPHS };
    }

    getStats() {
        const players = this.data.players || {};
        const java    = Object.keys(players).filter(u => !u.startsWith(".")).length;
        const bedrock = Object.keys(players).filter(u => u.startsWith(".")).length;
        return {
            total:     Object.keys(players).length,
            peak:      this.data.peak_online,
            whitelist: this.data.whitelist.length,
            java,
            bedrock,
        };
    }
}

module.exports = JoindateManager;