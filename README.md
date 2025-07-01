TODO:
1) Aggiunta archidekt : https://archidekt.com/_next/data/VCCAZuNu68DIIOVwXsTqa/search/decks.json?commanderName=patron+of+the+moon&deckFormat=3&orderBy=-updatedAt&page=1
2) Contaneirizzare la app
3) Test su pc windows
4) Test su android


comandi per container:

docker-compose build >>>>>>>>>>>>> per buildare
docker-compose up >>>>>>>>>>>>> per tirare su il container
docker-compose run --rm app "Patron of the Moon" 1 1 >>>>>>>>>>>>> per eseguire da container

se devo analizzare il contenuto del docker posso sovrascrivere nel docker-compose.yml con entrypoint: ["/bin/sh"]

ok e se metto nel docker-compose.yml l'entrypoint entrypoint: ["/bin/sh"] quando faccio docker-compose run --rm app "Patron of the Moon" 1 1 non funzionerebbe: dovrei entrare nel container e lanciarlo a mano giusto?

docker-compose run --rm app "Patron of the Moon" 1 1

non esegue il tuo script JS, perché stai sovrascrivendo l’entrypoint con /bin/sh, e quindi tutti gli argomenti "Patron of the Moon" 1 1 vengono ignorati o mal interpretati dalla shell.

In questo caso, dovresti:

Entrare nel container: docker-compose run --rm app
Lanciare manualmente il tuo script:  node src/index.js "Patron of the Moon" 1 1

Per avviare una shell: docker-compose run --rm --entrypoint /bin/sh app
Per lanciare l’app con argomenti (usando l’entrypoint originale del Dockerfile): docker-compose run --rm app "Patron of the Moon" 1 1