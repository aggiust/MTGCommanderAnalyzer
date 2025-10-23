const cardIds = [
'47297616',
'47297616',
'47084486',
'09748752',
'09748752',
'09748752',
'73125233',
'73125233',
'73125233',
'81278754',
'20663556',
'20663556',
'20663556',
'46239604',
'46239604',
'46239604',
'09126351',
'09126351',
'09126351',
'56052205',
'12538374',
'12538374',
'44330098',
'96947648',
'96947648',
'87910978',
'68005187',
'68005187',
'68005187',
'98045062',
'05318639',
'19613556',
'63356631',
'63356631',
'04178474',
'04178474',
'53582587',
'06540606',
'06540606',
'64697231',
'23693634',
'70780151',
'88643579',
'44508094',
'73580471',
'07391448',
'50321796',
'53714009',
'43385557',
'26593852',
'29071332',
'40854197',
'79229522',
'79229522',
'79229522',
'47084486',
'47084486',
'26205777',
'70095154',
'70095154',
'88240808',
'88240808',
'71413901',
'21502796',
'21502796',
'60082869',
'60082869',
'29401950',
'29401950',
'44095762'
];

async function fetchCardName(id) {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${id}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
    const data = await response.json();
    // L’API restituisce un array di carte, prendiamo la prima
    return data.data[0].name;
  } catch (err) {
    console.error(`Errore con ID ${id}:`, err.message);
    return null;
  }
}

async function main() {
  for (const id of cardIds) {
    const name = await fetchCardName(id);
    console.log(`${id} → ${name}`);
  }
}

main()