# HomeLab Manager

**Dein Homelab auf einen Blick.** HomeLab Manager ist eine Desktop-Anwendung für Windows und Linux, mit der du deine Server über [Beszel](https://beszel.dev/) im Blick behältst.

> **Voraussetzung:** Ein erreichbarer Beszel-Hub mit eingebundenen Systemen. HomeLab Manager ergänzt Beszel und ersetzt es nicht.

## Funktionen

- **Serverübersicht:** Über Beszel erkannte Server anzeigen, umbenennen, sortieren und mit eigenen Icons oder Weblinks versehen.
- **Monitoring:** Von Beszel bereitgestellte Werte wie CPU, Arbeitsspeicher, Temperatur, Laufwerke und Verläufe ansehen.
- **Docker-Ansicht:** Container anzeigen, wenn Docker-Daten vorliegen; eigene Gruppen erstellen, bearbeiten und löschen.
- **Eigene Webdienste:** Links auf Dienste im Homelab hinzufügen und individuell gestalten.
- **Personalisierung:** Hintergrundbilder, Logos und Reihenfolge anpassen.
- **Sicherung und Wiederherstellung:** Konfiguration exportieren und importieren; optional ein verschlüsseltes Komplettbackup erstellen.
- **Updates:** Signierte Desktop-Updates unter Windows, sobald eine neuere kompatible Version veröffentlicht wird.

Deine persönlichen Einstellungen werden lokal auf deinem Gerät gespeichert. Bei einer frischen Installation ist keine Beszel-Adresse voreingestellt.

## Installation

Passende Installationsdateien findest du unter **[GitHub Releases](https://github.com/VTubix/HomeLab-Manager/releases)**, sobald die jeweiligen Pakete veröffentlicht sind.

- **Windows:** Windows-Installer herunterladen und ausführen.
- **Linux:** Das angebotene Linux-Paket passend zu deinem System herunterladen. Die automatische Aktualisierung unter Linux ist noch nicht abschließend getestet.

## Erste Schritte

1. HomeLab Manager starten.
2. Die URL deines eigenen Beszel-Hubs eingeben.
3. Mit deinem Beszel-Konto anmelden.
4. Server, Icons, Verknüpfungen und Gruppen nach deinen Wünschen einrichten.

Die Docker-Ansicht erscheint nur, wenn Beszel passende Containerdaten liefert. Neue Nutzer starten ohne vorgefertigte Docker-Gruppen.

## Backups

Unter **Einstellungen → Konfiguration & Sicherung** kannst du Einstellungen sichern, exportieren und importieren. Beim Export kannst du den Speicherort auswählen. Eine Konfigurationssicherung kann die Beszel-Adresse enthalten, damit du sie auf einem neuen Rechner übernehmen und bei Bedarf ändern kannst.

Beim optionalen **verschlüsselten Komplettbackup** brauchst du zur Wiederherstellung das selbst festgelegte Passwort. Behandle Backup-Dateien vertraulich: Sie können interne Adressen und persönliche Einstellungen enthalten.

## Sicherheit

Nutze nach Möglichkeit **HTTPS oder ein VPN**, besonders bei Zugriffen außerhalb deines Heimnetzes. HomeLab Manager zeigt von Beszel bereitgestellte Daten an und ist kein eigenständiges Tool zur Verwaltung von Docker-Containern oder Servern.

HomeLab Manager ist ein unabhängiges Projekt und keine offizielle Beszel-Anwendung.

## Änderungen

Siehe [Changelog für v0.3.0](CHANGELOG-0.3.0.md).
