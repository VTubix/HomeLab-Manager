# HomeLab Manager v0.3.0 – öffentliche Quellcode-Fassung

## Enthalten
- Server ausschließlich aus dem verbundenen Beszel-Hub; Zuordnung pro stabiler Beszel-ID
- Eigene Server-Icons, Anzeigenamen und Webadressen
- Docker-Menü nur bei erfolgreich erkannten Containerdaten; keine festen Gruppen; selbst anlegen, umbenennen, löschen, Container zuordnen
- Standardmäßig kein Beszel-Server oder private IP voreingestellt
- Sicherung/Export mit Speicherortwahl, Beszel-Adresse im Export; Import auch bei geänderter Adresse
- Verschlüsselter Komplett-Export, lokaler App-Datenspeicher und geschützte Sitzung
- Vor Updater-Installation automatische interne Sicherung

## Noch vor öffentlichem Release zu erledigen
1. Auf Windows lokal mit `npm.cmd install` und `npm.cmd run tauri dev` testen.
2. `src-tauri/tauri.conf.json`: GitHub-Eigentümer, Repo und PUBLIC Update-Schlüssel einrichten (privaten Schlüssel niemals committen).
3. Vollständigen Windows- und Linux-Build sowie GitHub-Release-/Updater-Ablauf testen; Linux-Workflow veröffentlicht DEB/AppImage, aber Linux-Updater ist noch nicht Ende-zu-Ende geprüft.
4. **Die lokal signierte v0.2.3 lässt sich NICHT unverändert von GitHub aus aktualisieren.** Für den letzten Migrationstest ist eine separat vorbereitete v0.2.4 mit offiziellem Prüfschlüssel erforderlich.
5. Bei fremder Beszel-Neuinstallation können Server-IDs anders sein. Eine automatische ID-Migration ist bewusst nicht aktiv; Zuordnung muss bestätigt werden.

Hinweis: Der Datenexport enthält interne Webadressen. Niemals einen privaten Export ins öffentliche Repository hochladen.

## Korrektur: Erststart und alte WebView-Daten
- Die Desktop-App nutzt die native `preferences-v1.json` als maßgebliche Konfiguration. Ein vorhandenes JSON wird nie durch alte WebView-Daten überschrieben.
- Wenn die native Datei fehlt, startet die Anmeldemaske mit **leerer Beszel-Adresse**, auch wenn noch WebView-Daten oder ein Token im Windows-Schlüsselspeicher liegen.
- Falls tatsächlich alte v0.2.x-Einstellungen im WebView-Speicher gefunden werden, zeigt die App zwei ausdrückliche Möglichkeiten: **Bisherige Einstellungen übernehmen** oder **Neu einrichten**. Die Entscheidung muss vor einer Anmeldung getroffen werden.
- Die vorhandene Beszel-Sitzung wird nur automatisch geöffnet, wenn die gespeicherte Beszel-Adresse der konfigurierten Adresse entspricht. Es erfolgt keine stille Adressänderung aus dem Schlüsselspeicher.
- Bei Übernahme der Alt-Einstellungen schreibt die App die JSON-Datei und entfernt erst **nach erfolgreicher Speicherung** den veralteten localStorage-Eintrag.
- Für einen echten Neuanfang auf einem zuvor verwendeten Windows-Konto reicht das Neu-Entpacken der ZIP nicht aus. Bitte die bestehende Konfiguration vor einem isolierten Test sichern. Falls die App noch Alt-Einstellungen anzeigt, explizit **Neu einrichten** anklicken.

**Validierung:** JavaScript-Syntax geprüft. Ein vollständiger Tauri-/Windows-Build ist hier nicht möglich, weil npm-Pakete offline nicht vollständig verfügbar sind. Vor GitHub-Release unter Windows den Erststart sowie die Migration testen.
