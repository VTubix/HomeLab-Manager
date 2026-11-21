# HomeLab Manager – öffentliche GitHub-Vorlage (v0.2.3)

Windows-/Android-fähiges Tauri-2-Projekt zur Anzeige von Beszel-Systemen, Festplatten und Docker-Containern. Die Anwendung enthält die dunkelblaue Oberfläche, Monitoring, Gruppen, Sortierung, eigene Bilder, Webverknüpfungen und den vorbereiteten GitHub-Releases-Updater.

## Sicherheit

Diese Vorlage enthält **keine persönlichen lokalen IP-Adressen, internen DNS-Namen, Zugangsdaten, Tokens oder SSH-Schlüssel**. Die Beszel-Adresse ist beim ersten Start leer; weitere Dienst-Adressen werden lokal unter **Einstellungen** eingetragen. Auch bei einem öffentlichen Repository niemals reale Secrets oder Netzwerkkonfigurationen committen.

Die offiziellen externen Projekt-/Logo-URLs (z.B. GitHub und Plex) sind bewusst enthalten. Die App speichert Einstellungen beim Betrieb lokal, nicht im GitHub-Repository. Bereits auf deinem Rechner vorhandene Einstellungen können aufgrund der gleichbleibenden App-ID weiterhin geladen werden; das bedeutet **nicht**, dass sie im Quellcode enthalten sind.

## Lokal entwickeln

```powershell
npm.cmd install
npm.cmd run tauri dev
```

Vor dem ersten signierten Installer: `UPDATES-EINRICHTEN.md` lesen und `setup-updates.ps1` mit deinem eigenen Repository ausführen. Ein GitHub-Release oder Signierschlüssel ist nicht mitgeliefert.

## Öffentlich hochladen

Die Dateien dieses Projektordners hochladen, **nicht** ZIPs aus früheren privaten Versionen, `node_modules`, `src-tauri/target`, lokal erzeugte Konfigurationen oder persönliche Dateien. Die `.gitignore` unterstützt dabei, ersetzt aber keine Prüfung vor `git add` und `git push`.
