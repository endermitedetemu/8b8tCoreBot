#!/bin/bash
# Ejecutar este script UNA VEZ desde la carpeta joindate/
# bash setup_venv.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Creando entorno virtual en joindate/venv..."
python3 -m venv venv

echo "Instalando dependencias..."
venv/bin/pip install --upgrade pip -q
venv/bin/pip install reportlab -q

echo "Listo. El bot usará automáticamente este venv."
