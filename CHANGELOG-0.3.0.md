# HomeLab Manager 0.3.0 – Entwicklungsfassung

- Individuelle Servernamen, Icons, Weblinks, Docker-Gruppen und zusätzliche Webdienste.
- Monitoring über Beszel, Speicher und Docker-Ansichten sowie Personalisierung beibehalten.
- Native Speicherung von Einstellungen im App-Datenordner, unabhängig vom App-Build.
- Einmalige Übernahme vorhandener `homelab.v02.preferences`-Einstellungen.
- Lokales Backup vor durch die App installierten GitHub-Updates, inklusive der eigenen Bilder.
- Einstellungen: manuelles Backup, JSON-Export und JSON-Import (einschließlich Bilder).
- **Version bleibt 0.3.0.** GitHub-Updater benötigt vor Release noch Signierschlüssel und Repository-Einrichtung.

### Nachtrag: Trennung zwischen Erststart und Datenmigration
- Kein automatisches Übernehmen der alten Beszel-Adresse aus WebView-localStorage beim nativen Erststart.
- Bewusste Übernahme alter v0.2.x-Einstellungen oder neue Einrichtung auswählbar.
- Automatischer Sitzungsstart nur bei übereinstimmender, bereits gespeicherter Beszel-Adresse.
