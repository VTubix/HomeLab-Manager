# HomeLab Manager v0.3.0

Öffentliches Grundgerüst für einen Beszel-basierten HomeLab Manager (Tauri 2 + Vite).

## Start unter Windows

```powershell
npm.cmd install
npm.cmd run tauri dev
```

## Neu in v0.3.0

- Automatisch erkannte Beszel-Server mit individuellen Anzeigenamen, Weblinks und hochgeladenen Icons
- Frei definierbare Docker-Gruppen und Containerzuordnungen
- Eigene Webdienste hinzufügen
- Docker-Datenquelle auswählen
- Server- und Laufwerksüberwachung, Docker-Gruppen, Verlaufsdiagramme, lokale Designanpassungen

Alle individuellen Adressen und Bilder werden **lokal auf dem jeweiligen Gerät** gespeichert und gehören nicht ins öffentliche Repository. Eine GitHub-Updatequelle muss vor Erstellung eines Release-Installers gemäß `UPDATES-EINRICHTEN.md` eingerichtet werden.

## Sicherheit

Keine Zugangsdaten oder lokalen IP-Adressen in den Quellcode committen. Die App verwaltet keine Docker-Container, sondern zeigt Beszel-Statistiken und öffnet konfigurierte Webseiten. Bei HTTP-Beszel auf dem Heimnetz bitte nicht außerhalb eines vertrauenswürdigen Netzwerks verwenden. Für öffentliche Nutzung HTTPS oder VPN bevorzugen.

## Dauerhafte Einstellungen, Updates und Backups (in v0.3.0 enthalten)

- Desktop-Konfiguration wird unter dem betriebssystemspezifischen **Tauri-App-Datenverzeichnis** als `preferences-v1.json` gespeichert, **nicht** im Installationsordner oder Repository.
- Beim ersten Start der neuen Fassung werden Einstellungen aus dem bisherigen WebView-Speicher `homelab.v02.preferences` übernommen, falls noch keine native Konfigurationsdatei existiert. Die bestehende App-Kennung `de.homelab.manager` bleibt gleich.
- Individuelle Hintergrundbilder, Logos und Servericons bleiben als separate lokale Dateien im App-Datenverzeichnis.
- Vor einem über die App ausgeführten Update wird eine Kopie der Einstellungen **und Bilder** im Unterordner `backups/backup-<Zeitstempel>/` angelegt. Wenn diese Sicherung fehlschlägt, beginnt die Installation nicht.
- Unter **Einstellungen → Konfiguration & Sicherung** sind manuelle lokale Sicherung sowie JSON-Export und -Import verfügbar. Der Export kann Bilder und private Webadressen enthalten: **niemals in das öffentliche Repository hochladen**.
- Beszel-Passwörter und Anmeldungstokens sind nicht Bestandteil der Konfigurationsdatei oder des Exports; nach einem Neustart kann eine erneute Anmeldung erforderlich sein.
- Die neue native Dateispeicherung ist erst nach einem Test in einem echten Tauri-Fenster vollständig bestätigt. Vor dem ersten öffentlichen Release bitte Backup, Export, Import und Update an einer Testinstallation überprüfen.

**Linux:** Speicherort und Identität müssen bei späteren Linux-Paketen gleich bleiben, damit Einstellungen bei Updates erhalten bleiben. Einstellungen verschiedener Computer werden derzeit nicht automatisch synchronisiert.


## Ergänzung: geschützte Sitzungen und verschlüsselte Backups
Details siehe `SICHERHEIT-UND-MIGRATION.md`. Diese v0.3.0 ist eine **Testfassung**, nicht für öffentliche Releases freigegeben, bevor Windows-/Linux-Build und Migration getestet sind.


## Allgemeine Nutzung / öffentliche Veröffentlichung

Die Anwendung enthält **keine private Beszel-Adresse oder Zugangsdaten**. Nach einer frischen Installation trägt jeder Nutzer seine eigene Beszel-Adresse ein. Server werden ausschließlich aus Beszel gelesen. Persönliche Namen, Icons, URLs, Docker-Gruppen und Sortierungen werden lokal gespeichert.

**Docker-Gruppen:** Neue Installationen beginnen ohne vorgefertigte Gruppen. Erst wenn Beszel Containerdaten liefert, wird der Docker-Bereich angezeigt. Container starten unter „Nicht zugeordnet“ und können selbst angelegten Gruppen zugewiesen werden.

**Backups:** Lokale Sicherungen und Exporte erlauben die Auswahl des Speicherortes. JSON-Backups enthalten die Beszel-Adresse, aber keine Zugangsdaten. Das optionale verschlüsselte Komplettbackup kann einen Sitzungstoken enthalten.

**Noch nicht veröffentlichungsfertig:** `tauri.conf.json` enthält Platzhalter für GitHub-Releases und den öffentlichen Signier-Schlüssel. Bevor eine Release-EXE erstellt wird, diese Konfiguration ausfüllen und einen Windows-/Linux-Build sowie ein signiertes Update testen. Details in `FINAL-0.3.0-HINWEISE.md`.
