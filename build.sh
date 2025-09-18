#!/bin/bash

# Aktifkan 'mode tegas': jika ada perintah yang gagal, script langsung berhenti.
set -e

echo ">>> Starting robust build script..."

echo ">>> Attempting to install qpdf with YUM..."
# Kita jalankan instalasi qpdf
yum install -y qpdf
echo ">>> YUM command finished."

# Verifikasi apakah qpdf sudah ter-install dan bisa ditemukan
echo ">>> Verifying qpdf installation..."
command -v qpdf
echo ">>> qpdf has been successfully installed at the path above."

echo ">>> Running standard npm install..."
npm install
echo ">>> Build script finished successfully."