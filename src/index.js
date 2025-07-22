import { launch } from 'puppeteer';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { Selectors } from './selectors.js';

// parsing del file appsettings
const raw = fs.readFileSync('./settings/appsettings.json');
const appsettings = JSON.parse(raw);

// funzione per recuperare l'id del comandante 
async function getCommanderIdMoxfield(name) {
  const url = `${appsettings.moxfield.getCommanderId}${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const data = await res.json();

  let id = "";

  data.data?.forEach(element => {
    if(element.name.toLowerCase() == name.toLowerCase())
      id = element.id
  })

  return id;
}

// funzione per recuperare la lista dei deck con quello specifico comandante
async function getDecksMoxfield(commanderCardId, numberOfDecks, sortType, dateGreaterThan = undefined) {
  const deckIds =  []; // array con id dei deck (moxfield)
  const moreDeckStats = []; // array che conterrà stats aggiuntive del mazzo

  const url = `${appsettings.moxfield.getDecksPart1}${numberOfDecks}${appsettings.moxfield.getDecksPart2}${sortType}${appsettings.moxfield.getDecksPart3}${commanderCardId}`;
  const res = await fetch(url);
  const decks = await res.json();

  decks.data.forEach(element => {
    if(dateGreaterThan == undefined){
      deckIds.push(element.publicId);
      moreDeckStats.push({likes: element.likeCount, views: element.viewCount, name: element.name, updatedAt: element.lastUpdatedAtUtc, createdAt: element.createdAtUtc})
    }
    else if(dateGreaterThan != undefined && new Date(element.lastUpdatedAtUtc) >= new Date(dateGreaterThan)){
      deckIds.push(element.publicId);
      moreDeckStats.push({likes: element.likeCount, views: element.viewCount, name: element.name, updatedAt: element.lastUpdatedAtUtc, createdAt: element.createdAtUtc})
    }
  });

  const deckInfo = {deckIds : deckIds, moreDeckStats: moreDeckStats}
  return deckInfo;
}

function populateDecklist(cardName, cardDetails, supportingArray){
  const quantity = cardDetails.quantity;

  let price = 0; // Default a 0 se il prezzo non è disponibile
  if (cardDetails.card && cardDetails.card.prices && (cardDetails.card.prices.eur != undefined || cardDetails.card.prices.eur != null)) {
      price = cardDetails.card.prices.eur;
  } else if (cardDetails.card && cardDetails.card.prices && (cardDetails.card.prices.eur_foil != undefined || cardDetails.card.prices.eur_foil != null)){
      price = cardDetails.card.prices.eur_foil;
  }

  const cardObject = {
      name: cardName, 
      price: price,
      qty: quantity
  };
  supportingArray.push(cardObject);
}

// recupero la lista specifica di un mazzo
async function getDeckDetailsMoxfield(deckId, cardsStatsArray) {

  const url = `${appsettings.moxfield.getDeckDetail}${deckId}`;
  const res = await fetch(url);
  const data = await res.json();

  const supportingArray = [];

  if (data.commanders){
    for( const cardName in data.commanders){
      if(Object.prototype.hasOwnProperty.call(data.commanders, cardName)){
          const cardDetails = data.commanders[cardName];
          populateDecklist(cardName, cardDetails, supportingArray);
       }
    }
  }

  // valutazione companion?
  // if (data.companions){
  //   for( const cardName in data.companions){
  //     if(Object.prototype.hasOwnProperty.call(data.companions, cardName)){
  //         const cardDetails = data.comapanions[cardName];
  //         populateDecklist(cardName, cardDetails, supportingArray);
  //      }
  //   }
  // }

  // 1. Recupera le informazioni delle carte nel "mainboard"
  if (data.mainboard) {
      // Itera sugli oggetti all'interno di 'mainboard'. Le chiavi di 'mainboard' sono i nomi delle carte.
      for (const cardName in data.mainboard) {
          // Assicurati che 'cardName' sia una proprietà diretta dell'oggetto e non del prototipo
          if (Object.prototype.hasOwnProperty.call(data.mainboard, cardName)) {
              const cardDetails = data.mainboard[cardName];
              populateDecklist(cardName, cardDetails, supportingArray);
          }
      }
  }

  cardsStatsArray.push(supportingArray);
}

// funzione che dato un array di oggetti cardsStatsArray restituisce un array di stringhe qty nome (utilizzabili da inserire in una textarea)
function generateDeckMoxfield(cardsStatsArray){
    const decklistArray = [];
    
    for(let i = 0; i<cardsStatsArray.length; i++){
        let decklist = "";
        for(let j=0; j<cardsStatsArray[i].length; j++){
            decklist += cardsStatsArray[i][j].qty + " " + cardsStatsArray[i][j].name + '\n';
        }
        decklistArray.push(decklist);
    }

    return decklistArray;
}

// funzione per creare l'url per interrogare edh power level
function buildEdhPowerLevelUrl(decklistString) {
  // --- 1. Estraggo [qty, name] usando un’unica regex ---
  const cardRegex = /(\d+)\s+([^0-9]+?)(?=\s+\d+\s+|$)/g;
  const mainDeck = [];
  let m;
  while ((m = cardRegex.exec(decklistString)) !== null) {
    const qty  = m[1];
    const name = m[2].trim();
    mainDeck.push({ qty, name });
  }

  // encoding dell'url
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, '+').replace(/'/g, '%27');
  const mainPart   = mainDeck.map(c => `${c.qty}+${enc(c.name)}`).join('~');
  const deckString = `${mainPart}~Z~`;
  return `${appsettings.edhpowerlevel.baseUrl}${deckString}`;
}

// funzione con puppeteer per chiamare un certo url per edhpowerlevel e leggere la power del mazzo
async function analyzeDeckEDHPowerLevel(urlToCall) {
    const browser = await launch({
        headless: 'new',                         // 100 % headless
        args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',             // evita crash per /dev/shm piccolo
        '--disable-gpu',
        '--ozone-platform=headless'            // niente X/Wayland
        ],
    });
   const page = await browser.newPage();

   try {
    console.log('🌐 edhpowerlevel.com');
     // vado direttamente all'url della pagina con il risultato già calcolato
     await page.goto(urlToCall, { waitUntil: 'networkidle2' });
     await page.waitForSelector(Selectors.edhPowerlevelResult, { timeout: 15000 });

     // recupero del bracket:
    const bracket = await page.evaluate(() => {
      const container = document.querySelector(
        '#edh-power-level > main > div > div.row.mt-5 > div.results-wrap.col-12 > div.row.framed-bottom > div > div.row.m-0.mx-lg-3'
      );

      if (!container) return null;

      // Seleziona SOLO i div figli diretti (o come preferisci)
      const divs = Array.from(container.querySelectorAll('div'));

      const targetDiv = divs.find(div =>
        div.classList.contains('ok') && div.classList.contains('recommended')
      );

      const strong = targetDiv.querySelector('div > strong');
      const lvl = strong ? strong.innerText.trim() : null;

      console.log('il lvl del mazzo è:', lvl);

      return lvl;
    });

    const pl = await page.$eval(Selectors.edhPowerlevelResult, el => el.textContent.trim());

    return {
      bracket: bracket,
      powerlevel: pl,
    }
   } catch (err) {
     console.error(`Errore:`, err.message);
     return null;
   } finally {
     await browser.close();
   }
}

async function analyzeDeckEDHCardsRealm(cards) {
    const url = `${appsettings.cardsRealm.baseUrl}`;

    const browser = await launch({
        headless: 'new',                         // 100 % headless
        args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',             // evita crash per /dev/shm piccolo
        '--disable-gpu',
        '--ozone-platform=headless'            // niente X/Wayland
        ],
    });

    const page = await browser.newPage();
    // per evitare che venga rilevato come bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    try {
        console.log('🌐 cardsrealm.com');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Aumenta il timeout per il goto

        // accetto i cookie di tracciamento
        try {
          await page.click(Selectors.cardsRealmAcceptCookie, { timeout: 5000 });
          console.log('Click cookie riuscito');
        } catch (err) {
          console.log('Nessun cookie da cliccare, passo avanti');
        }

        await page.waitForSelector(Selectors.cardsRealmInputBox, { timeout: 10000 }); // Attende che l'input sia presente
        await page.click(Selectors.cardsRealmInputBox);

        // La callback di page.$eval() gira dentro la pagina: al suo interno esistono solo i parametri che le passi esplicitamente, non le variabili del tuo script Node.
        // Inoltre, se l’app usa React/Vue/Angular o ha listener sull’input, limitarsi a cambiare el.value potrebbe non attivare la logica di binding; conviene quindi emettere anche l’evento input (o change).

        await page.$eval(
            Selectors.cardsRealmInputBox,       // "#inputMain"
            (el, value) => {
              el.value = value;                 // imposta il testo
              el.dispatchEvent(                 // notifica l’app
                new Event('input', { bubbles: true })
              );
            },
            cards                               // <-- parametro passato al browser
          );
        //await page.type(Selectors.cardsRealmInputBox, cards, { delay: 0 });  // Inserisco la lista delle carte

        await page.click(Selectors.cardsRealmAnalyzeBtn); // Clicca sul pulsante di calcolo

        // page.waitForFunction(...) richiama automaticamente e periodicamente la funzione che gli passi, fino a quando:
        // 1) la funzione restituisce un valore "truthy" (qualcosa di diverso da false, null, undefined, 0, "", ecc.),
        // 2) oppure scade il timeout specificato.
        const powerLevelResultHandle = await page.waitForFunction(
          () => {
            try {
              const el = document.getElementById('power_level');
              if (!el) return false;

              const text = el.textContent.trim();
              const num = parseInt(text);

              return text !== '' && text !== '0' && text !== '1' && !isNaN(num) && num > 1
                ? text
                : false;
            } catch {
              return false;
            }
          },
          { timeout: 60000 }
         );

        // Una volta che waitForFunction ha successo, estrai il valore
        const result = await powerLevelResultHandle.jsonValue();
        return result;
    } catch (err) {
        console.error(`Errore:`, err.message);
        return null;
    } finally {
        console.log('Closing browser...');
        await browser.close();
    }
}

// entrypoint del progetto
async function main() {

    // struttura che contiene oggetti fatti nel seguente modo:
    // {name, price, qty}
    const cardsStatsArray = [];
    // recupero dei dati
    const commanderName = process.argv[2];
    const numberOfDecks = process.argv[3];
    let sortType = process.argv[4];
    const dateGreaterThan = process.argv[5];

    if(sortType == '1')
        sortType = "views";
    else sortType = "likes";

    console.log(`1. Cerco commander "${commanderName}"`);
    // recupero l'id del commander per moxfield
    const commanderId = await getCommanderIdMoxfield(commanderName);

    console.log('cid', commanderId);

    if (!commanderId) {
        console.error('Commander non trovato');
        return;
    }

    // recupero i deck
    console.log(`2. Recupero mazzi per commanderId = ${commanderId}`);
    const decksStats = await getDecksMoxfield(commanderId, numberOfDecks, sortType, dateGreaterThan);
    const decks = decksStats.deckIds;
    const moreStats = decksStats.moreDeckStats;

    console.log(`3. Creo le decklist`);
    // per ogni deck recuperato allo step precedente, recupero i dettagli. Gli passo anche l'array da popolare
    for(let id of decks){
        await getDeckDetailsMoxfield(id, cardsStatsArray);
    }

    console.log(`4. Creo le decklist in formato testuale inseribile nella textarea`);
    const decklistArray = generateDeckMoxfield(cardsStatsArray);
    
    const resultArray = []; // array di oggetti che conterrà url del deck, edhpowerlevel, cardsrealmpowerlevel, costo

    // interrogazione di edhpowerlevel.com e cardsrealm per la valutazione dei deck
    for (let i = 0; i < decklistArray.length; i++) {
        const urlToCall = buildEdhPowerLevelUrl(decklistArray[i], i);
        console.log(`[DECK #${i+1}]`);
        const resultEdhPowerLevel = await analyzeDeckEDHPowerLevel(urlToCall);
        const resultEdhCardsRealm = await analyzeDeckEDHCardsRealm(decklistArray[i]);
        
        const deckPrice = cardsStatsArray[i].reduce((acc, x) => acc + parseFloat(x.price || 0), 0); // dove acc è l'accumulatore e 0 è l'initial value

        const o = {
            url: `${appsettings.moxfield.decks}${decks[i]}`,
            name: moreStats[i].name,
            likes: moreStats[i].likes,
            views: moreStats[i].views,
            createdAt: moreStats[i].createdAt,
            updatedAt: moreStats[i].updatedAt,
            powerlevel_edhpl: resultEdhPowerLevel?.powerlevel ?? "No data",
            powerlevel_cardsrealm: resultEdhCardsRealm ?? "No data",
            bracket: resultEdhPowerLevel?.bracket ?? "No data",
            price: parseFloat(deckPrice).toFixed(2)
        }

        resultArray.push(o);
    }

    console.log("resultArray: ", resultArray);

    const sorted = [...resultArray]
      .map(r => ({ ...r, _p: Number(r.price) }))       // _p = prezzo numerico
      .sort((a, b) => (isNaN(a._p) ? 1 : isNaN(b._p) ? -1 : a._p - b._p))
      .map(({ _p, ...r }) => ({ ...r, price: isNaN(_p) ? '' : _p })); // ripulisce

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sorted);
    XLSX.utils.book_append_sheet(wb, ws, 'Decks');

    // Scrive il file localmente
    XLSX.writeFile(wb, `results/decks_${commanderId}.xlsx`, { bookType: 'xlsx' });
 }

main().catch(err => console.error('Errore:', err));