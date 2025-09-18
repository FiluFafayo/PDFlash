#!/bin/bash
set -e

echo ">>> Starting final build script..."

echo ">>> Installing qpdf and its dependencies..."
yum install -y qpdf

echo ">>> Creating a directory for our binaries inside the API folder..."
mkdir -p api/_bin

echo ">>> Copying qpdf executable and required libraries..."
cp /usr/bin/qpdf api/_bin/

cp /usr/lib64/libqpdf.so.* api/_bin/
cp /usr/lib64/libjpeg.so.* api/_bin/

# ==========================================================
# TAMBAHKAN BARIS INI UNTUK MENYALIN "AKI" YANG HILANG
# ==========================================================
cp /usr/lib64/libgnutls.so.* api/_bin/
# ==========================================================

echo ">>> All binaries and libraries copied."

echo ">>> Running standard npm install..."
npm install
echo ">>> Build script finished successfully."