# GitHub-Releases-Updates einrichten (Windows)

**Bevor du den ersten Installer erstellst.** Die Update-Oberfläche ist in v0.2.3 programmiert, die Release-Adresse und der **öffentliche** Prüfschlüssel müssen aber erst auf dein eigenes GitHub-Repository eingestellt werden. Ohne diesen Schritt ist ein produktiver Release-Build nicht bereit.

## 1. GitHub-Repository

Erstelle auf GitHub ein Repository, z.B. `homelab-manager`. Für die hier vorgesehene statische Releases-URL sollte das Release öffentlich lesbar sein; **niemals** Beszel-Passwörter, Tokens, IP-Portfreigaben oder private Schlüssel in Releases einbetten. Diese öffentliche Vorlage enthält keine persönlichen LAN-Adressen. Prüfe vor jedem Commit trotzdem auf neu hinzugefügte private Daten und Zugangsinformationen.

## 2. Auf deinem PC Schlüssel erzeugen und Repository eintragen

Starte im entpackten Projektordner nach `npm.cmd install` (GitHub-Namen anpassen):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup-updates.ps1 -Repository "DEINNAME/homelab-manager"
```

Der Tauri-Signer erstellt den privaten Schlüssel **nur lokal** in `C:\Users\DEINNAME\.tauri\homelab-manager.key` und die passende öffentliche `.pub`-Datei. Bei vorhandenen Schlüsseln werden diese nicht überschrieben. Sichere den privaten Schlüssel samt eventueller Passphrase außerhalb des Projekts. **Niemals senden oder committen!** Ein Verlust macht Updates für bereits installierte Versionen mit diesem Schlüssel unmöglich.

Danach steht in `src-tauri/tauri.conf.json` dein Repository und der öffentliche Schlüssel. **Nur die Konfiguration mit dem öffentlichen Schlüssel darf ins Repository.**

## 3. GitHub Actions Secrets hinterlegen

Repository → Settings → Secrets and variables → Actions → New repository secret:

- `TAURI_SIGNING_PRIVATE_KEY` = Inhalt deiner lokalen `.key`-Datei (bei GitHub direkt, **nicht hier im Chat**).
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = Passphrase der `.key`, falls gewählt; sonst kann die Variable leer bleiben.

Wenn du deinen Schlüssel nicht bei GitHub Actions hinterlegen willst, kannst du signierte Release-Artefakte manuell auf deinem Windows-PC bauen und veröffentlichen. Das Workflow-Beispiel benötigt für automatische Builds den Schlüssel als GitHub-Secret.

## 4. Projekt veröffentlichen

Installiere Git (falls nötig) und lade das Projekt in dein Repository hoch, **nachdem** du alle privaten Daten aus dem Quellcode geprüft hast. Dateien `*.key` sind über `.gitignore` ausgeschlossen.

Für einen Release muss die Version in **`package.json`**, **`src-tauri/Cargo.toml`** und **`src-tauri/tauri.conf.json`** übereinstimmen. Hier ist sie `0.2.3`.

Veröffentliche über einen Git-Tag wie `v0.2.3`. Die enthaltene GitHub-Action baut den Windows-NSIS-Installer und veröffentlicht die signierten Update-Artefakte plus `latest.json` im Release. Kontrolliere im Release, dass `latest.json`, `.exe` und `.sig` vorhanden sind.

## 5. Erstinstallation & Updates

Installiere den **NSIS-Installer aus GitHub Releases**. Nicht nur `src-tauri/target/release/homelab_manager.exe` kopieren: Der Updater ist für den Installer vorgesehen.

Die installierte App prüft beim Start nach einer neueren Version. In **Einstellungen → App-Updates** kannst du erneut prüfen und, falls vorhanden, installieren. **Die Installation erfolgt erst nach deinem Klick.** Der Signaturcheck ist Pflicht. Die lokale App-Einstellung bleibt über Updates bei gleicher App-ID erhalten.

Zum Test der Update-Kette: Version 0.2.3 installieren, dann z.B. `0.2.4` bauen und veröffentlichen. Die App mit 0.2.3 sollte 0.2.4 finden.

### Entwicklungsmodus

`npm.cmd run tauri dev` funktioniert auch ohne GitHub-Setup; die Updatefunktion ist dort bewusst deaktiviert. `npm.cmd run tauri build` **erst nach der Einrichtung** mit privaten Signier-Umgebungsvariablen ausführen. Ein echter Build und eine GitHub-Release-Veröffentlichung wurden hier nicht ausgeführt.

### Sicherheit

Die GitHub-Release-URL nutzt HTTPS. Das Update wird vor Installation mit deinem eingebetteten öffentlichen Schlüssel kryptografisch verifiziert. Das schützt die Update-Pakete, ersetzt aber keine optionale Windows-Authenticode-Signatur gegen SmartScreen-Warnungen beim ersten Installer.

Dokumentation: https://v2.tauri.app/plugin/updater/ · https://tauri.app/distribute/pipelines/github/
