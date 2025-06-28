import { launch } from 'puppeteer';
import fs from 'fs';
import { Selectors } from './selectors.js';

// parsing del file appsettings
const raw = fs.readFileSync('./settings/appsettings.json');
const appsettings = JSON.parse(raw);

// funzione per recuperare l'id del comandante 
async function getCommanderIdMoxfield(name) {
  const url = `${appsettings.moxfield.getCommanderId}${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data?.[0]?.id;
}

// funzione per recuperare la lista dei deck con quello specifico comandante
async function getDecksMoxfield(commanderCardId, numberOfDecks, sortType) {
  const deckIds =  []; // array con id dei deck (moxfield)

  const url = `${appsettings.moxfield.getDecksPart1}${numberOfDecks}${appsettings.moxfield.getDecksPart2}${sortType}${appsettings.moxfield.getDecksPart3}${commanderCardId}`;
  console.log(url)
  const res = await fetch(url);
  const data = await res.json();

  data.data.forEach(element => {
    deckIds.push(element.publicId);
  });

  return deckIds;
}

// recupero la lista specifica di un mazzo
async function getDeckDetailsMoxfield(deckId, cardsStatsArray) {

  const url = `${appsettings.moxfield.getDeckDetail}${deckId}`;
  const res = await fetch(url);
  const data = await res.json();

  const o = {
    name: data.main.name,
    price: data.main.prices.eur,
    qty: 1
  }

  const supportingArray = [];
  supportingArray.push(o);

  // 1. Recupera le informazioni delle carte nel "mainboard"
  if (data.mainboard) {
      // Itera sugli oggetti all'interno di 'mainboard'. Le chiavi di 'mainboard' sono i nomi delle carte.
      for (const cardName in data.mainboard) {
          // Assicurati che 'cardName' sia una proprietà diretta dell'oggetto e non del prototipo
          if (Object.prototype.hasOwnProperty.call(data.mainboard, cardName)) {
              const cardDetails = data.mainboard[cardName];

              const quantity = cardDetails.quantity;

              let price = 0; // Default a 0 se il prezzo non è disponibile
              if (cardDetails.card && cardDetails.card.prices && cardDetails.card.prices.eur !== undefined) {
                  price = cardDetails.card.prices.eur;
              }
              const cardObject = {
                  name: cardName, 
                  price: price,
                  qty: quantity
              };
              supportingArray.push(cardObject);
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
        '--single-process',
        '--no-zygote',
        '--ozone-platform=headless'            // niente X/Wayland
        ],
    });
   const page = await browser.newPage();

   try {
    console.log('🌐 edhpowerlevel.com');
     // vado direttamente all'url della pagina con il risultato già calcolato
     await page.goto(urlToCall, { waitUntil: 'networkidle2' });
     await page.waitForSelector(Selectors.edhPowerlevelResult, { timeout: 15000 });

     return await page.$eval(Selectors.edhPowerlevelResult, el => el.textContent.trim());
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
        '--single-process',
        '--no-zygote',
        '--ozone-platform=headless'            // niente X/Wayland
        ],
    });

    const page = await browser.newPage();
    // per evitare che venga rilevato come bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    try {
        console.log('🌐 cardsrealm.com');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // Aumenta il timeout per il goto

        // accetto i cookie di tracciamento
        await page.click(Selectors.cardsRealmAcceptCookie);
        await page.waitForSelector(Selectors.cardsRealmInputBox, { timeout: 10000 }); // Attende che l'input sia presente
        await page.click(Selectors.cardsRealmInputBox);
        await page.type(Selectors.cardsRealmInputBox, cards, { delay: 5 });  // Inserisco la lista delle carte

        await page.click(Selectors.cardsRealmAnalyzeBtn); // Clicca sul pulsante di calcolo

        // page.waitForFunction(...) richiama automaticamente e periodicamente la funzione che gli passi, fino a quando:
        // 1) la funzione restituisce un valore "truthy" (qualcosa di diverso da false, null, undefined, 0, "", ecc.),
        // 2) oppure scade il timeout specificato.
        const powerLevelResultHandle = await page.waitForFunction(() => {
            const powerLevelElement = document.getElementById('power_level'); // recupero il powerlevel
            if (powerLevelElement) {
                const currentText = powerLevelElement.textContent.trim();
                const currentValue = parseInt(currentText); // Prova a convertirlo in numero

                // La condizione: il testo non è "1", non è vuoto, e convertibile a un numero valido diverso da 1
                if (currentText != '0' && currentText != '1' && currentText !== '' && !isNaN(currentValue)) {
                    return currentText; // Restituisce il testo aggiornato
                }
            }
            return false; // Continua ad aspettare
        }, {
            timeout: 60000 // Timeout generoso di 60 secondi per il calcolo
        });

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

    if(sortType == '1')
        sortType = "views";
    else sortType = "likes";

    console.log(`1. Cerco commander "${commanderName}"`);
    // recupero l'id del commander per moxfield
    const commanderId = await getCommanderIdMoxfield(commanderName);
    if (!commanderId) {
        console.error('Commander non trovato');
        return;
    }

    // recupero i deck
    console.log(`2. Recupero mazzi per commanderId = ${commanderId}`);
    const decks = await getDecksMoxfield(commanderId, numberOfDecks, sortType);

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
        console.log(urlToCall);
        const resultEdhPowerLevel = await analyzeDeckEDHPowerLevel(urlToCall);
        const resultEdhCardsRealm = await analyzeDeckEDHCardsRealm(decklistArray[i]);
        
        const deckPrice = cardsStatsArray[i].reduce((acc, x) => acc + x.price, 0); // dove acc è l'accumulatore e 0 è l'initial value

        const o = {
            url: `${appsettings.moxfield.decks}${decks[i]}`,
            list: decklistArray[i],
            edhpl: resultEdhPowerLevel,
            cardsrealmpl: resultEdhCardsRealm,
            price: parseFloat(deckPrice).toFixed(2)
        }

        resultArray.push(o);
    }

    console.log("resultArray: ", resultArray);
 }

main().catch(err => console.error('Errore:', err));