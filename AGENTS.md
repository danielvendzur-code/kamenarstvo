# Pravidlá pre agenta (Codex)

Pracuješ na **Kamenárstvo Studio** – jednom základe 3D konfigurátora pomníkov, ktorý sa cez nastavenia prispôsobí pre ľubovoľné kamenárstvo. Celý plán je v `studio/PLAN.md`. **Rob vždy len tú etapu, ktorú máš v zadaní.**

## Šetri kredity
- Nečítaj celé repo. Čítaj len `AGENTS.md`, `studio/PLAN.md` a súbory, ktoré meníš.
- Súbory v koreni (`index.html`, `3d.html`, `kamenarstvo3d.html`, `lacnejsia-verzia.html`, `app.js`, `fixes.*`, `assets/`) sú stará verzia pre Jantár. **Nemeň ich ani ich nečítaj celé.** Z `kamenarstvo3d.html` si môžeš vziať len vizuálny štýl (farby, písma).
- Nič neinštaluj, ak to zadanie nevyžaduje. Žiadne npm balíky, žiadny build.
- Jedna etapa = jedna vetva = jeden PR. Na konci napíš krátke zhrnutie: čo je hotové, čo nie a prečo.

## Technické pravidlá
- Všetko patrí do priečinka `studio/`. Čisté HTML + CSS + ES moduly (`<script type="module">`), bez build kroku.
- Three.js iba z `studio/vendor/` (stiahni `three.module.min.js` a potrebné addons z `three@0.160.0`, presná verzia, žiadne CDN v produkcii).
- Žiadne údaje firmy natvrdo v kóde. Všetko (názov, farby, písma, kontakty, katalóg, texty) sa načíta z `studio/klienti/<slug>/config.json`. Vzorová firma: `studio/klienti/vzor/`.
- Iba písma s licenciou OFL (Google Fonts) uložené lokálne v `studio/fonts/`. Žiadne textúry ani modely s neistou licenciou: kameň sa generuje procedurálne v shaderi.
- Jazyk rozhrania: slovenčina. Všetky texty rozhrania v `studio/i18n/sk.json`, aby šla neskôr čeština.
- Žiadne ceny, ak ich `config.json` nemá (`"ceny": null` znamená „Cena na dopyt“).
- Mobil je prvoradý: od 360 px šírky, ovládanie palcom, žiadne vodorovné posúvanie.
- Výkon: na slabom mobile aspoň 30 fps, na desktope 60 fps. `devicePixelRatio` obmedziť na 2 (mobil 1.5). Kreslí sa len pri zmene alebo pohybe kamery, inak stojí (šetrí batériu).
- Prístupnosť: všetky ovládacie prvky ovládateľné klávesnicou, `aria-label`, kontrast AA, rešpektovať `prefers-reduced-motion`.
- Každá podstránka ukážky má `<meta name="robots" content="noindex,nofollow">`.
- Neposielaj žiadne skutočné e-maily ani formuláre. Odoslanie dopytu sa v ukážke len simuluje, ak `config.json` nemá nastavené EmailJS.

## Kontrola pred PR
- Otvor `studio/index.html?k=vzor` cez `python3 -m http.server` a over, že v konzole nie sú chyby.
- Prilož do PR screenshoty: desktop 1440×900 a mobil 390×844 (Playwright, ak je k dispozícii).
- Splň presne podmienky „Hotové, keď“ z danej etapy v `studio/PLAN.md`.
