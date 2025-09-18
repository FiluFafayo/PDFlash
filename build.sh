#!/bin/bash

# Memberi tahu log bahwa proses instalasi kustom dimulai
echo ">>> Installing custom dependencies with YUM: qpdf"

# Menjalankan instalasi qpdf menggunakan YUM (tanpa sudo)
yum install -y qpdf

# Memberi tahu log bahwa instalasi kustom selesai
echo ">>> Custom dependencies installed."

# Menjalankan instalasi standar npm
echo ">>> Running npm install..."
npm install