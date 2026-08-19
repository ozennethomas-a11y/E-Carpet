#!/bin/bash
# Installe un LaunchAgent macOS qui tente une sauvegarde de la base à chaque
# ouverture de session (login) — le script backup-db.mjs ne fait réellement
# quelque chose que si le dernier backup a plus de 30 jours, donc ça ne
# spamme pas à chaque connexion.
#
#   bash scripts/install-backup-schedule.sh

set -e
SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/shop.ecarpet.backup.plist"
NODE_BIN="$(command -v node)"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>shop.ecarpet.backup</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$SITE_DIR/scripts/backup-db.mjs</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$HOME/E-Carpet-Backups/backup.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/E-Carpet-Backups/backup.log</string>
</dict>
</plist>
EOF

mkdir -p "$HOME/E-Carpet-Backups"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Installé : une sauvegarde sera tentée à chaque connexion (effective tous les 30 jours)."
echo "Dossier des backups : $HOME/E-Carpet-Backups"
echo "Log : $HOME/E-Carpet-Backups/backup.log"
