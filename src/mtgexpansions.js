import fs from 'fs';

async function getCardPrintings(cardName) {
  const searchUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
  const response = await fetch(searchUrl);
  if (!response.ok) throw new Error(`Errore nella ricerca di ${cardName}`);

  const cardData = await response.json();

  const printsUrl = cardData.prints_search_uri;
  const printsResponse = await fetch(printsUrl);
  if (!printsResponse.ok) throw new Error(`Errore nel recupero delle ristampe di ${cardName}`);

  const printsData = await printsResponse.json();

  const sets = printsData.data.map(print => ({
    setName: print.set_name,
    setCode: print.set,
    releasedAt: print.released_at
  }));

  // Rimuovo duplicati
  return Array.from(new Map(sets.map(s => [s.setCode, s])).values());
}

async function main() {
  // Leggo il file cards.txt dalla cartella files
  const fileContent = fs.readFileSync("./files/cards.txt", "utf-8");

  // Splitto per righe e rimuovo spazi vuoti
  const cardList = fileContent
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Mappa dei set
  const setMap = new Map();

  for (const card of cardList) {
    try {
      const sets = await getCardPrintings(card);

      for (const s of sets) {
        if (!setMap.has(s.setCode)) {
          setMap.set(s.setCode, { setName: s.setName, cards: [] });
        }
        setMap.get(s.setCode).cards.push(card);
      }
    } catch (err) {
      console.error(`Errore per ${card}:`, err.message);
    }
  }

  // Trasformo in array e ordino per numero di carte trovate
  const ranking = Array.from(setMap.values())
    .map(entry => ({
      setName: entry.setName,
      count: entry.cards.length,
      cards: entry.cards
    }))
    .sort((a, b) => b.count - a.count);

  // Stampo la classifica
  console.log("\nClassifica dei set più comuni:");
  ranking.forEach(r => {
    console.log(`- ${r.setName}: ${r.count} carte [${r.cards.join(", ")}]`);
  });
}

main();
