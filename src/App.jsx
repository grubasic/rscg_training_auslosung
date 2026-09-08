import React, { useEffect, useMemo, useState } from "react";

const FIXED_PLAYERS = [
  "Andreas Moitzi", "Annina Ebhardt", "Anton Pleva", "Bernd Engelbrecht",
  "Christian Grasgruber", "Christoph Krainer", "David Edlinger", "Georg Schenn",
  "Gerwin Hofmeister", "Jakob Beck", "Marc Trummer", "Martin Ehrenreich",
  "Mathias Heschl", "Nikolaus Kronabitter", "Patrick Gruber", "Patrick Tatzer",
  "Simon Kampitsch", "Stefan Gruber", "Stefan Steiner"
];

const ROUND_TIMES = ["00:00-00:30", "00:30-01:00", "01:00-01:30", "01:30-02:00"];
const GUEST = "__guest__";
const SELECTION_KEY = "padel-selections-v3";
const HISTORY_KEY = "padel-history-v3";

function emptySelections() {
  return Array.from({ length: 8 }, () => ({ type: "fixed", value: "", guestName: "" }));
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function keyFromNames(a, b) {
  return [a.trim().toLocaleLowerCase("de"), b.trim().toLocaleLowerCase("de")].sort().join("|");
}

function perfectMatchings(indices) {
  if (!indices.length) return [[]];
  const first = indices[0];
  const results = [];
  for (let i = 1; i < indices.length; i += 1) {
    const partner = indices[i];
    const rest = indices.filter((_, index) => index !== 0 && index !== i);
    for (const matching of perfectMatchings(rest)) results.push([[first, partner], ...matching]);
  }
  return results;
}

const ALL_MATCHINGS = perfectMatchings([0, 1, 2, 3, 4, 5, 6, 7]);

function historicalPairCounts(history) {
  const counts = new Map();
  history.forEach((entry) => {
    (entry.partnerPairs || []).forEach((pair) => counts.set(pair, (counts.get(pair) || 0) + 1));
  });
  return counts;
}

function buildSchedule(players, history) {
  const usedThisTraining = new Set();
  const selected = [];
  const pastCounts = historicalPairCounts(history);

  function search(round) {
    if (round === 4) return true;
    const candidates = ALL_MATCHINGS
      .filter((matching) => matching.every(([a, b]) => !usedThisTraining.has(keyFromNames(players[a], players[b]))))
      .map((matching) => ({
        matching,
        score: matching.reduce((sum, [a, b]) => sum + (pastCounts.get(keyFromNames(players[a], players[b])) || 0), 0) + Math.random() * 0.2
      }))
      .sort((a, b) => a.score - b.score);

    for (const candidate of candidates.slice(0, 30)) {
      const keys = candidate.matching.map(([a, b]) => keyFromNames(players[a], players[b]));
      keys.forEach((key) => usedThisTraining.add(key));
      selected.push(shuffle(candidate.matching));
      if (search(round + 1)) return true;
      selected.pop();
      keys.forEach((key) => usedThisTraining.delete(key));
    }
    return false;
  }

  if (!search(0)) return null;
  return selected.map((teams) => {
    const randomized = shuffle(teams);
    return [
      { court: 1, teamA: randomized[0], teamB: randomized[1] },
      { court: 2, teamA: randomized[2], teamB: randomized[3] }
    ];
  });
}

function scheduleText(schedule, players) {
  const lines = ["🎾 Padel Training", ""];
  schedule.forEach((round, roundIndex) => {
    lines.push(`Runde ${roundIndex + 1} (${ROUND_TIMES[roundIndex]})`);
    round.forEach((match) => {
      lines.push(`Platz ${match.court}: ${players[match.teamA[0]]} / ${players[match.teamA[1]]} vs. ${players[match.teamB[0]]} / ${players[match.teamB[1]]}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

function Team({ pair, players, tone }) {
  return (
    <div className={`team ${tone}`}>
      <div>{players[pair[0]]}</div><small>&amp;</small><div>{players[pair[1]]}</div>
    </div>
  );
}

export default function App() {
  const [selections, setSelections] = useState(emptySelections);
  const [players, setPlayers] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [editing, setEditing] = useState(true);
  const [history, setHistory] = useState([]);
  const [notice, setNotice] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    try {
      const savedSelections = JSON.parse(localStorage.getItem(SELECTION_KEY) || "null");
      const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      if (Array.isArray(savedSelections) && savedSelections.length === 8) setSelections(savedSelections);
      if (Array.isArray(savedHistory)) setHistory(savedHistory);
    } catch { /* Lokale Daten ignorieren, wenn sie ungueltig sind. */ }
  }, []);

  const resolvedNames = useMemo(() => selections.map((entry) =>
    entry.type === "guest" ? entry.guestName.trim() : entry.value.trim()
  ), [selections]);

  const selectedFixed = useMemo(() => new Set(
    selections.filter((entry) => entry.type === "fixed" && entry.value).map((entry) => entry.value)
  ), [selections]);

  const namesValid = useMemo(() => {
    const normalized = resolvedNames.map((name) => name.toLocaleLowerCase("de"));
    return resolvedNames.every(Boolean) && new Set(normalized).size === 8;
  }, [resolvedNames]);

  function updateSelection(index, value) {
    setSelections((current) => current.map((entry, position) => {
      if (position !== index) return entry;
      return value === GUEST
        ? { type: "guest", value: "", guestName: "" }
        : { type: "fixed", value, guestName: "" };
    }));
    setSchedule(null);
    setNotice("");
  }

  function savePlayers() {
    if (!namesValid) return;
    setPlayers(resolvedNames);
    setEditing(false);
    setSchedule(null);
    localStorage.setItem(SELECTION_KEY, JSON.stringify(selections));
  }

  function createSchedule() {
    const next = buildSchedule(players, history);
    if (!next) {
      setNotice("Es konnte keine gueltige Auslosung erstellt werden.");
      return;
    }
    setSchedule(next);
    setNotice("");
  }

  function saveHistory() {
    if (!schedule) return;
    const partnerPairs = schedule.flatMap((round) => round.flatMap((match) => [
      keyFromNames(players[match.teamA[0]], players[match.teamA[1]]),
      keyFromNames(players[match.teamB[0]], players[match.teamB[1]])
    ]));
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("de-AT"),
      players,
      partnerPairs,
      schedule
    };
    const next = [entry, ...history];
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setNotice("Auslosung wurde in der Partnerhistorie gespeichert.");
  }

  async function shareWhatsApp() {
    const text = scheduleText(schedule, players);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function clearAll() {
    setSelections(emptySelections());
    setPlayers([]);
    setSchedule(null);
    setEditing(true);
    setNotice("");
    localStorage.removeItem(SELECTION_KEY);
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    setNotice("Partnerhistorie wurde geloescht.");
  }

  return (
    <main>
      <div className="container">
        <header>
          <div className="badges"><b>2 Plätze</b><span>19 Stammspieler + Gäste</span><span>8 Teilnehmer</span><span>4 × 30 Minuten</span></div>
          <h1>Padel <em>Partner-Auslosung</em></h1>
          <p>Wähle acht Teilnehmer. Innerhalb eines Trainings wird kein Teampartner wiederholt, historische Wiederholungen werden möglichst vermieden.</p>
        </header>

        <div className="layout">
          <section className="panel sidebar">
            <div className="panel-title"><h2>Teilnehmer</h2>{!editing && <button className="link" onClick={() => setEditing(true)}>Ändern</button>}</div>
            {editing ? (
              <div className="selection-list">
                {selections.map((entry, index) => (
                  <div className="selection" key={index}>
                    <label><b>{index + 1}</b> Teilnehmer {index + 1}</label>
                    <select value={entry.type === "guest" ? GUEST : entry.value} onChange={(event) => updateSelection(index, event.target.value)}>
                      <option value="">Namen auswählen ...</option>
                      {FIXED_PLAYERS.map((name) => <option key={name} value={name} disabled={selectedFixed.has(name) && entry.value !== name}>{name}</option>)}
                      <option value={GUEST}>+ Gastspieler eintragen</option>
                    </select>
                    {entry.type === "guest" && <input value={entry.guestName} placeholder="Vor- und Nachname des Gastes" onChange={(event) => setSelections((current) => current.map((item, pos) => pos === index ? { ...item, guestName: event.target.value } : item))} />}
                  </div>
                ))}
                {!namesValid && <div className="warning">Bitte acht unterschiedliche Teilnehmer auswählen oder eintragen.</div>}
                <button className="primary" disabled={!namesValid} onClick={savePlayers}>Teilnehmer übernehmen</button>
                <button className="secondary" onClick={clearAll}>Auswahl leeren</button>
              </div>
            ) : (
              <div className="player-grid">{players.map((name, index) => <div key={name}><b>{index + 1}.</b> {name}</div>)}</div>
            )}

            <div className="actions">
              <button className="primary large" disabled={editing || players.length !== 8} onClick={createSchedule}>{schedule ? "Neu auslosen" : "Vier Runden auslosen"}</button>
              {schedule && <>
                <button className="whatsapp" onClick={shareWhatsApp}>Per WhatsApp teilen</button>
                <button className="secondary" onClick={() => window.print()}>Drucken / als PDF speichern</button>
                <button className="secondary cyan" onClick={saveHistory}>In Historie speichern</button>
              </>}
              <button className="secondary" onClick={() => setHistoryOpen(!historyOpen)}>Partnerhistorie ({history.length})</button>
              {notice && <div className="notice">{notice}</div>}
            </div>

            <div className="rule"><strong>Garantierte Regel</strong><br />Kein Spieler erhält während der vier Runden zweimal denselben Teampartner.</div>
          </section>

          <section className="content">
            {historyOpen && <div className="panel history">
              <div className="panel-title"><h2>Partnerhistorie</h2>{history.length > 0 && <button className="link danger" onClick={clearHistory}>Historie löschen</button>}</div>
              {history.length === 0 ? <p>Noch keine Auslosung gespeichert.</p> : history.map((entry) => <div className="history-entry" key={entry.id}><b>{entry.date}</b><span>{entry.players.join(", ")}</span></div>)}
            </div>}
            {!schedule ? (
              <div className="empty"><div className="ball">↻</div><h2>Bereit zur Teilnehmerauswahl</h2><p>Wähle links acht Personen aus und erstelle den vollständigen Spielplan.</p></div>
            ) : schedule.map((round, roundIndex) => (
              <article className="panel round" key={roundIndex}>
                <div className="round-header"><h2>Runde {roundIndex + 1}</h2><span>{ROUND_TIMES[roundIndex]}</span></div>
                <div className="courts">{round.map((match) => (
                  <div className="court" key={match.court}>
                    <div className="court-title"><b>Platz {match.court}</b><span>Match</span></div>
                    <div className="versus"><Team pair={match.teamA} players={players} tone="blue" /><b>VS</b><Team pair={match.teamB} players={players} tone="pink" /></div>
                  </div>
                ))}</div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
