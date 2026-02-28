const fs = require('fs');
const path = require('path');

class Storage {
  constructor(filename) {
    this.filepath = path.join(__dirname, '..', filename);
  }

  load() {
    try {
      if (fs.existsSync(this.filepath)) {
        const data = fs.readFileSync(this.filepath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error al cargar archivo:', error);
    }
    return [];
  }

  save(data) {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error al guardar archivo:', error);
      return false;
    }
  }
}

module.exports = Storage;