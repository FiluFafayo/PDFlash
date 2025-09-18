#!/bin/bash

# Memberi tahu log bahwa proses instalasi kustom dimulai
echo ">>> Installing custom dependencies: qpdf"

# Menjalankan instalasi qpdf (tanpa sudo)
apt-get update && apt-get install -y qpdf

# Memberi tahu log bahwa instalasi kustom selesai
echo ">>> Custom dependencies installed."

# Menjalankan instalasi standar npm
echo ">>> Running npm install..."
npm install
