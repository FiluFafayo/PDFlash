#!/bin/bash
if [ "$QPDF_INSTALL" == "true" ]; then
  echo "Installing qpdf..."
  sudo apt-get update && sudo apt-get install -y qpdf
  echo "qpdf installed."
fi