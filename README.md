TODO:
1) pubblicare su dockerhub
2) Test su pc windows
3) Test su android


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

Riassunto:

con docker compose up -d posso lanciare più container contemporaneamente su che sono definiti nel docker-compose.yml. dopodichè posso vedere se è attivo con docker ps -a. A quel punto prendo il nome del container e faccio docker exec -it nome-ctr sh. Da qui dentro posso lanciare il comando node per eseguire lo script o npm run dev nel caso fosse una pagina spa come vue. poi docker compose down per tirarlo giù. 

Al posto di tutto ciò posso fare docker-compose run --rm app "Patron of the Moon" 1 1 per tirare su il container/i containers on demand, calcolare i risultati e una volta terminata la computazione rimuovere il container.

ENTRYPOINT nel Dockerfile definisce il comando principale che viene eseguito ogni volta che il container parte. È l’anima del tuo container: appena lo avvii, si esegue quello.

Nel tuo caso: ENTRYPOINT ["node", "src/index.js"]

Significa che quando fai docker compose up, o anche docker run, il container esegue direttamente: node src/index.js


Con ENTRYPOINT settato (es. "node src/index.js")
Avvii automatici

docker compose up -d → esegue node src/index.js appena parte il container.

docker compose run --rm app "Patron of the Moon" 1 1 → viene eseguito come: node src/index.js "Patron of the Moon" 1 1

Qui non serve entrare manualmente nel container, perché il comportamento è già definito

Con ENTRYPOINT = null (cioè rimosso o non definito)

Il container non ha istruzioni di avvio automatiche.

Comandi come: docker compose run --rm app "Patron of the Moon" 1 1
non funzionano correttamente, perché Docker non sa cosa eseguire.

Devi per forza: 
1) docker compose up -d
2) docker exec -it node-app sh
3) node src/index.js "Patron of the Moon" 1 1


Adesso è possibile pushare l'immagine su docker hub. Scaricarla da un altro dispositivo e runnarla con docker run <nome_img> "Patron of the Moon" 2 2