#!/bin/bash
set -e

echo ">>> Starting final build script..."

echo ">>> Installing qpdf and its dependencies..."
yum install -y qpdf

echo ">>> Creating a directory for our binaries inside the API folder..."
mkdir -p api/_bin

echo ">>> Copying qpdf executable and required libraries..."
# Salin program utamanya
cp /usr/bin/qpdf api/_bin/

# SALIN DENGAN WILDCARD (*) UNTUK MENEMUKAN VERSI YANG BENAR SECARA OTOMATIS
# Ini akan menyalin file seperti libqpdf.so.29, libqpdf.so.30, dll.
cp /usr/lib64/libqpdf.so.* api/_bin/
cp /usr/lib64/libjpeg.so.* api/_bin/

echo ">>> All binaries and libraries copied."

echo ">>> Running standard npm install..."
npm install
echo ">>> Build script finished successfully."