# Dungeons & Dortmund einrichten

Die App besteht nur aus statischen Dateien (kein eigener Server nötig). Als
gemeinsame Datenbank nutzt sie Firebase Firestore (kostenlos), gehostet wird
sie über GitHub Pages (kostenlos) — genau wie die Haushalt-App.

## Was die App kann

- **Storyline**: gemeinsamer Feed, in den jeder reinschreiben kann, was die
  letzte Session passiert ist.
- **Charaktere**: jeder Charakterbogen ist ein geteiltes Dokument. Alle in der
  Runde sehen dieselben Daten in Echtzeit und können sie bearbeiten — keiner
  muss mehr sein Papier-Blatt mitschleppen.
  - Attribute (STR/DEX/INT/WIL), HP inkl. Temp-HP, Initiative, Armor, Hit Dice,
    Größe/Speed/Gewicht, Level (1–20, per Stepper).
  - Wounds als klickbare Pips (mit Skull am Ende), Anzahl konfigurierbar.
  - 10 Skills (Arcana, Examination, Finesse, Influence, Insight, Lore, Might,
    Naturecraft, Perception, Stealth) mit Grundwert + Plus, Gesamt wird live
    berechnet.
  - Geld getrennt nach Kupfer/Silber/Gold/Platin, auch als Kurzanzeige auf der
    Charakterkarte.
  - Waffenliste mit Anlegen-Checkbox (max. 2 gleichzeitig, angelegte Waffen
    rutschen nach oben), Kategorisierung (Einhand/Zweihand,
    Nahkampf/Fernkampf, Magisch), Schadenswürfel und Freitext für
    Besonderheiten.
  - Gegenstandsliste mit Anzahl, Wirkung/Beschreibung und ein paar
    vorgeschlagenen Klassikern (Fackel, Seil, Rationen, …) als Autocomplete.
  - **Weitergeben**: Waffen und Gegenstände können an jeden anderen Charakter
    in der Datenbank übergeben werden (Menge wählbar bei Gegenständen) — wird
    beim einen abgezogen und beim anderen exakt gleich gutgeschrieben.
  - Jede Änderung an Waffen/Gegenständen zeigt an, wer sie zuletzt geändert
    hat.
  - Quest-Log als persönlicher Notiz-Feed pro Charakter.

## 1. Firebase-Projekt erstellen

1. Gehe zu https://console.firebase.google.com
2. "Projekt hinzufügen" → Namen vergeben, z.B. `dungeons-und-dortmund`
   (**wichtig:** ein eigenes, neues Projekt anlegen — nicht das der
   Haushalt-App wiederverwenden, sonst landen die Daten in derselben
   Datenbank)
3. Google Analytics kannst du deaktivieren (nicht nötig)
4. "Projekt erstellen" abwarten

## 2. Firestore Database aktivieren

1. Im linken Menü: **Build → Firestore Database** → "Datenbank erstellen"
2. Standort wählen (z.B. `eur3 (europe-west)`)
3. Mit **"Im Testmodus starten"** beginnen (wir ersetzen die Regeln gleich manuell)

## 3. Sicherheitsregeln setzen

Im Firestore-Menü auf den Tab **"Regeln"** und den Inhalt komplett ersetzen durch:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Dann **"Veröffentlichen"** klicken.

> Hinweis: Damit ist die Datenbank offen für jeden, der die Projekt-ID kennt.
> Für eine Runde ohne Login ist das der pragmatische Kompromiss. Die
> Standard-Testmodus-Regel von Firebase läuft nach 30 Tagen ab, diese Regel
> hier tut das nicht.

## 4. Web-App registrieren

1. Zurück zur Projektübersicht → Zahnrad oben links → **"Projekteinstellungen"**
2. Runterscrollen zu **"Meine Apps"** → auf das Web-Symbol `</>` klicken
3. App-Spitzname eingeben, z.B. `Dungeons & Dortmund Web`
4. **Firebase Hosting NICHT aktivieren** (brauchen wir nicht, wir nutzen GitHub Pages)
5. "App registrieren" — es erscheint ein Code-Block mit `const firebaseConfig = {...}`

## 5. Config eintragen

Öffne die Datei `firebase-config.js` aus diesem Ordner und ersetze die
Platzhalter-Werte durch die echten Werte aus Schritt 4.

Diese Werte sind **nicht geheim** — bei Firebase-Web-Apps ist die Absicherung
allein Aufgabe der Firestore-Regeln aus Schritt 3, nicht der Config selbst.

## 6. GitHub-Repository erstellen

Der lokale Ordner heißt `Dungeons & Dortmund` — Leerzeichen und `&` sind für
einen GitHub-Repo-Namen aber ungünstig (werden in der URL hässlich codiert).
Nimm für das Repository einen URL-freundlichen Namen, z.B. `dungeons-und-dortmund`.

1. https://github.com/new
2. Repository-Name: `dungeons-und-dortmund`, Sichtbarkeit **Public**
3. "Create repository"
4. Auf der Repo-Seite: **"Add file" → "Upload files"**
5. Alle Dateien aus diesem Ordner reinziehen:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `firebase-config.js` (mit deinen echten Werten!)
   - `manifest.webmanifest`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
6. Unten "Commit changes"

## 7. GitHub Pages aktivieren

1. Im Repository: **Settings → Pages** (linkes Menü)
2. Unter "Build and deployment" → Source: **"Deploy from a branch"**
3. Branch: **main**, Ordner: **/ (root)** → **Save**
4. Nach ca. 1 Minute ist die Seite erreichbar unter:
   `https://DEIN-GITHUB-NAME.github.io/dungeons-und-dortmund/`

## 8. Auf dem Handy installieren

1. Link im Browser öffnen (iPhone: Safari, Android: Chrome)
2. **iPhone:** Teilen-Symbol (Quadrat mit Pfeil) → "Zum Home-Bildschirm"
3. **Android:** Menü (⋮) → "App installieren" / "Zum Startbildschirm hinzufügen"
4. Beim ersten Öffnen fragt die App nach eurem Namen — das reicht als "Login"
   und wird bei jeder Änderung als "zuletzt geändert von" angezeigt.

Jeder in der Runde sollte die App einmal öffnen und seinen Namen eingeben.
Der Name lässt sich später jederzeit über den Chip oben rechts ändern.

## Änderungen später vornehmen

Wenn du später etwas am Code ändern willst: Datei lokal bearbeiten, dann im
GitHub-Repo über "Add file → Upload files" erneut hochladen (überschreibt die
alte Version automatisch). Die Seite aktualisiert sich innerhalb von ca. 1 Minute.
