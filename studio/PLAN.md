# Kamenárstvo Studio – plán

Cieľ: jeden krásny a presvedčivý 3D konfigurátor pomníkov, ktorý sa za 1–2 hodiny prispôsobí ľubovoľnému kamenárstvu (logo, farby, písma, ich produkty a kamene, kontakty) a vloží sa do podstránky, ktorá vyzerá ako súčasť ich webu. Slúži ako personalizovaná ukážka, ktorú posielame firmám.

Štýl: pokojný, dôstojný, prémiový. Svetlé teplé pozadie, veľa vzduchu, elegantné pätkové písmo v nadpisoch (napr. Cormorant Garamond, Cinzel), čisté bezpätkové písmo v ovládaní (Inter). Žiadne lacné efekty, žiadne emoji. Inšpirácia: konfigurátor koverta.sk (3D vľavo/hore, kroky vpravo/dole, súhrn a dopyt na konci).

## Štruktúra
```
studio/
  index.html            konfigurátor (samostatne alebo v iframe), ?k=<slug>
  ukazka.html           podstránka „ako ich web“, ?k=<slug>
  css/studio.css        dizajn, všetko cez CSS premenné z configu
  js/
    app.js              štart, načítanie configu, stav, URL
    scena.js            renderer, svetlo, kamera, kvalita podľa zariadenia
    kamen.js            procedurálny materiál žuly/mramoru (shader)
    tvary.js            parametrické modely (pomníky, dosky, doplnky)
    pismo.js            vytesané písmo (canvas → mapy)
    ui.js               kroky, výbery, súhrn, dopyt
  katalog/zaklad.json   predvolený katalóg (tvary, kamene, písma, doplnky)
  klienti/vzor/config.json + logo.svg   vymyslená vzorová firma
  i18n/sk.json
  fonts/  vendor/
```

## config.json (schéma)
```json
{
  "firma": { "nazov": "Kamenárstvo Vzor", "slogan": "Pomníky s úctou od roku 1998",
             "telefon": "+421 900 000 000", "email": "info@vzor.sk", "web": "https://vzor.sk",
             "adresa": "Hlavná 1, 000 00 Mesto", "logo": "logo.svg" },
  "tema": { "pozadie": "#f6f1ea", "text": "#2a211b", "akcent": "#8a6a3f", "akcent2": "#2f3b35",
            "pismoNadpis": "Cormorant Garamond", "pismoText": "Inter", "zaoblenie": 14 },
  "web":  { "menu": ["Úvod","Pomníky","Hrobky","Doplnky","Kontakt"], "heroObrazok": null,
            "patickaText": "© Kamenárstvo Vzor" },
  "katalog": { "zaklad": "zaklad", "pomniky": ["jednohrob","dvojhrob"], "dosky": ["urna","pamatna"],
               "tvary": ["rovny","obluk","kniha","vlna"],
               "kamene": ["impala","absolute-black","aurora","viscont-white","tan-brown","indian-juparana"],
               "pisma": ["cinzel","cormorant","playfair","great-vibes"],
               "farbyPisma": ["zlata","strieborna","biela","piesokovana"],
               "doplnky": ["vaza","lampas","fotokeramika","kriz","ornament-ruza"] },
  "ceny": null,
  "dopyt": { "emailjs": null, "gdprUrl": "#" }
}
```
Katalóg firmy je výber z `katalog/zaklad.json` (len to, čo firma naozaj predáva). Názvy kameňov v UI sú všeobecné obchodné názvy.

## Obsah konfigurátora
- **Pomníky:** jednohrob (cca 100×200 cm) a dvojhrob (cca 200×200 cm). Časti: obruba, krycia doska (celá / delená / s otvorom na kvety), stela (tabuľa) v 4 tvaroch: rovný, oblúk, kniha (otvorená kniha), vlna (asymetrická). Rozmery parametricky, rozumné rozsahy.
- **Dosky:** doska na urnu (cca 40×40 cm, šikmá na podstavci) a pamätná doska (cca 60×40 cm, na stenu). Tvar rovný/oblúk.
- **Kamene (6):** procedurálny shader: zrnitosť (2–3 oktávy šumu), škvrny/kryštály, jemné žilky, lesk leštenej plochy vs. matný štiepaný bok (bočné plochy hrubšie a svetlejšie, leštené čelo tmavé so zrkadlením okolia). Parametre kameňa v katalógu (farby, veľkosť zrna, kontrast, žilky).
- **Písmo:** meno, priezvisko, dátumy (narodenia/úmrtia, symboly * a †), epitaf (1–2 riadky). 4 písma, 4 farby. Vytesané písmo: text sa vykreslí do canvasu, z neho maska + normal/bump mapa (V-rez), farba a lesk sa miešajú v shaderi (zlatá a strieborná metalické, biela matná, pieskovaná = svetlejší matný kameň). Pri dvojhrobe dve mená vedľa seba. Automatické zarovnanie a zmenšenie dlhého textu.
- **Doplnky:** váza, lampáš, fotokeramika (ovál, s ukážkovou siluetou; vlastná fotka sa nahrá len lokálne v prehliadači, nikam sa neposiela), kríž, ornament (ruža). Umiestnenie na preddefinované pozície.
- **Scéna:** jemné prostredie cintorína naznačené abstraktne (tráva/štrk pod pomníkom, rozostrené pozadie, mäkké tiene). Žiadne realistické cudzie hroby ani kríže v pozadí. Denné mäkké svetlo, ACES tonemapping, environment map generovaná v kóde (RoomEnvironment alebo vlastný gradient) pre odlesky leštenej žuly.

## Ovládanie a UX
- Kroky: 1 Typ (pomník / doska) → 2 Tvar a rozmer → 3 Kameň → 4 Nápis → 5 Doplnky → 6 Súhrn a dopyt.
- Výbery ako karty s malým náhľadom. Zmena sa v 3D prejaví hneď (plynulý prechod).
- Kamera: otáčanie, priblíženie, tlačidlá „Spredu“, „Z boku“, „Detail nápisu“. Obmedziť, aby nešlo pod zem.
- Súhrn: zoznam volieb, obrázok návrhu (snímka canvasu), odkaz na zdieľanie (stav v URL), formulár dopytu (meno, telefón, e-mail, cintorín/obec, poznámka, súhlas GDPR).
- Mobil: 3D hore (cca 45 % výšky), kroky dole, navigácia Späť/Ďalej palcom.

## Kvalita a výkon (poznatky z koverta.sk)
- Úrovne kvality podľa zariadenia (slabý mobil: tieň 1024, DPR 1.25, bez doplnkových efektov; desktop: tieň 2048, DPR do 2).
- Kresliť len pri zmene; pri státí jemné vyhladenie (napr. niekoľko snímok s posunutou kamerou a spriemerovanie), aby boli hrany a písmo ostré.
- Kontaktný tieň pod pomníkom (mäkký, nízkej hustoty), aby pomník „sedel“ na zemi.
- Mapy písma: rozlíšenie podľa veľkosti steny (max 2048), anizotropné filtrovanie.

## Etapy (každá = 1 zadanie = 1 PR)
1. **Kostra + scéna + jeden pomník.** Štruktúra priečinkov, načítanie `config.json` a katalógu, téma cez CSS premenné, renderer so svetlom, tieňmi, prostredím a kamerou, procedurálna žula (1 kameň), jednohrob s rovnou stelou. UI zatiaľ len základný panel.
   *Hotové, keď:* `index.html?k=vzor` ukáže čistý jednohrob z leštenej čiernej žuly s realistickým odleskom, mäkkým tieňom, bez chýb v konzole; zmena farieb v `config.json` zmení vzhľad UI bez zásahu do kódu.
2. **Všetky tvary a kamene.** Jednohrob a dvojhrob so 4 tvarmi steliel a 3 typmi krycej dosky, 2 dosky, 6 kameňov, leštené vs. štiepané plochy.
   *Hotové, keď:* každá kombinácia sa vykreslí bez artefaktov (žiadne blikanie plôch, prekrývanie, diery) a kamene sú od seba jasne rozlíšiteľné aj na mobile.
3. **Písmo a doplnky.** Vytesané písmo so 4 písmami a 4 farbami, dátumy, epitaf, dvojhrob s dvomi menami, doplnky vrátane fotokeramiky.
   *Hotové, keď:* zlaté písmo pôsobí ako skutočné zlátenie v hĺbke kameňa (nie ako nálepka), dlhé mená sa správne zmenšia, text je ostrý pri priblížení.
4. **Kroky, súhrn, dopyt.** Celé UI podľa „Ovládanie a UX“, stav v URL, snímka návrhu, simulované odoslanie dopytu.
   *Hotové, keď:* celý postup ide prejsť na mobile 390×844 palcom, odkaz na zdieľanie obnoví presne ten istý návrh.
5. **Podstránka „ako ich web“ + vzorová firma.** `ukazka.html`: hlavička s logom a menu z configu, úvodný pás, vložený konfigurátor, sekcia „Ako to funguje“ (3 kroky), kontakt, pätička. Nenápadný pruh hore: „Ukážka návrhu pre {firma} – pripravila Koverta Studio“.
   *Hotové, keď:* po výmene `config.json` (iné logo, farby, písmo, menu) stránka vyzerá ako iná firma; `noindex` je na každej stránke.
6. **Dokončenie.** Výkon na mobile, Lighthouse, prístupnosť, Playwright testy so screenshotmi (desktop + mobil, všetky typy), `studio/README.md`: ako pridať novú firmu krok za krokom.
   *Hotové, keď:* Lighthouse mobil výkon ≥ 80 a prístupnosť ≥ 95, testy prechádzajú, návod umožní pridať firmu bez programovania.

## Pridanie novej firmy (cieľ 1–2 h)
1. Skopírovať `klienti/vzor` → `klienti/<slug>`.
2. Vyplniť `firma`, `tema` (farby a písmo z ich webu), `web.menu`.
3. V `katalog` nechať len to, čo predávajú (tvary, kamene, doplnky).
4. Pridať logo. Skontrolovať `ukazka.html?k=<slug>` na mobile a desktope.
5. Poslať súkromný odkaz s textom „návrh pre vás“.
