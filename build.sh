#!/bin/bash
set -e

echo ">>> Starting final build script..."

echo ">>> Installing qpdf and its dependencies..."
yum install -y qpdf

echo ">>> Creating a directory for our binaries inside the API folder..."
# Kita buat folder _bin di dalam /api agar ikut di-deploy
mkdir -p api/_bin

echo ">>> Copying qpdf executable and required libraries..."
# Salin program utamanya
cp /usr/bin/qpdf api/_bin/

# Salin "onderdil" (shared libraries) yang dibutuhkan qpdf
# Build log menunjukkan qpdf-libs diinstall, biasanya isinya ada di /usr/lib64
cp /usr/lib64/libqpdf.so.29 api/_bin/
cp /usr/lib64/libjpeg.so.62 api/_bin/

echo ">>> All binaries and libraries copied."

echo ">>> Running standard npm install..."
npm install
echo ">>> Build script finished successfully."