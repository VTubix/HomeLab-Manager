# HomeLab Manager v0.3.0 – Sicherheit und Migration

- Automatisch angezeigt werden nur Server, die die angemeldete Beszel-Instanz über die `systems`-API liefert. Weitere Server benötigen einen Beszel-Agent und Eintrag im Hub.
- Anpassen je Server: Anzeigename, URL, Icon; Zuordnung erfolgt über Beszel-ID. Vorhandene Links nach Servernamen werden weiterhin gelesen.
- Beszel-Passwort wird nicht gespeichert. Das Sitzungstoken wird über den betriebssystemeigenen Schlüsselspeicher verwaltet (Windows Credential Manager; unter Linux funktionierender Secret Service vorausgesetzt). Nach Tokenablauf oder Widerruf erneut anmelden.
- WebView `localStorage` und App-Datenordner behalten ihre bestehende ID (`de.homelab.manager`) für die Migration. **Nicht** die alten App-Daten löschen.
- Backup: Einfacher JSON-Export ohne Sitzung; Komplettbackup enthält Token, Einstellungen und Bilder, aber ausschließlich in einer mit AES-256-GCM verschlüsselten JSON-Datei. Schlüsselableitung PBKDF2-SHA256, 600.000 Iterationen, 16-Byte Salt, 12-Byte IV. Das Passwort ist **nicht wiederherstellbar**. Verschlüsseltes Backup sicher verwahren.
- Die automatische Vor-Update-Sicherung erstellt lokale Daten/Asset-Kopien, **ohne** Anmeldung. Der Token bleibt unabhängig im Betriebssystem-Schlüsselspeicher erhalten.
- Desktop-Entwicklungsmodus kann denselben App-Datenordner wie eine Release-Installation verwenden. Vor dem ersten Test die vorhandenen v0.2.x-Dateien und App-Daten sichern; bitte nicht mit realen Updates anfangen, bevor der Installer getestet ist.
- Linux: Installation des Secret-Service-Dienstes / entsperrter Keyring kann notwendig sein. Ohne ihn wird die Anmeldung aus Sicherheitsgründen nicht ungeschützt gespeichert.
- Nur für die eigene vertrauenswürdige Beszel-Instanz verwenden. Im LAN-HTTP ist das Login-Netzwerk nicht TLS-verschlüsselt; außerhalb des vertrauenswürdigen Heimnetzes VPN oder HTTPS verwenden.
- Keine private Serveradresse, Zugangsdaten oder Tokens sind im öffentlichen Repository enthalten. Nur `setup-updates.ps1` konfiguriert später die öffentliche GitHub-Release-Quelle und den öffentlichen Signatur-Prüfschlüssel.

## Testplan
1. v0.2.3 unverändert behalten. Daten und Konfiguration sichern.
2. `npm.cmd install`, `npm.cmd run tauri dev`, dann einmal anmelden.
3. App schließen und erneut starten: geschützte Sitzung muss wiederhergestellt werden.
4. Eigenen Servernamen, URL und Icon festlegen; App erneut starten.
5. Komplettbackup verschlüsselt exportieren und testweise importieren; neue Anmeldung sollte nur nötig sein, wenn Token abgelaufen ist.
6. Einen temporären Server im Beszel-Hub hinzufügen oder entfernen und prüfen, dass die App automatisch nur die vorhandenen Server anzeigt.
7. Erst nach Tests das Repository mit GitHub Desktop aktualisieren und Releases signieren.
