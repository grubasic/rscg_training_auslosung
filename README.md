# Padel Partner-Auslosung

Vite-React-App fuer 8 Teilnehmer, 2 Plaetze und 4 Runden.

## Lokal starten

1. Node.js LTS installieren.
2. Im Projektordner ausfuehren:

```bash
npm install
npm run dev
```

## Produktions-Build

```bash
npm run build
```

Der fertige Build befindet sich danach im Ordner `dist`.

## Vercel

Repository importieren. Vercel erkennt Vite automatisch. Falls Einstellungen erforderlich sind:

- Build Command: `npm run build`
- Output Directory: `dist`

## Funktionen

- 19 feste Stammspieler
- Auswahl von 8 Teilnehmern
- Gastspieler
- Vier Runden auf zwei Plaetzen
- Keine doppelten Teampartner innerhalb eines Trainings
- Partnerhistorie im Browser
- Historische Wiederholungen werden nach Moeglichkeit minimiert
- WhatsApp-Weitergabe
- Drucken oder als PDF speichern
