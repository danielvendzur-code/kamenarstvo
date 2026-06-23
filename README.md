# Kamenárstvo Jantár — konfigurátor pomníka + AI asistent

Samostatný widget (jeden súbor `index.html` + fotky v `assets/`) pre **Kamenárstvo Jantár**.
Plávajúca bublina vpravo dole otvorí panel s **konfigurátorom pomníka** a **AI asistentom**.
**Bez cenovej kalkulačky** — cieľom je návrh a nezáväzný dopyt.

## Čo widget vie
- **Fotorealistický živý náhľad** — reálne fotky pomníkov (`assets/images/graves/`), na ktoré sa
  v reálnom čase vykresľuje zadaný **nápis** (farba zo skutočných vzoriek `assets/images/lettering/`).
- **7 krokov konfigurátora:** Tvar → Veľkosť → Kameň → Nápis a písmo → Doplnky → **Miesto realizácie** → Zhrnutie + dopyt.
- **AI asistent** v rovnakom paneli (prepínač hore). Funguje lokálne; voliteľne sa napojí na vlastný backend.
- **Dopyt** cez EmailJS / e-mail / WhatsApp + súhlas GDPR.
- Plne responzívne, na mobile fullscreen, rešpektuje `prefers-reduced-motion`.

## Vzťahy fotka ↔ výber
- Pomníky: `assets/images/graves/{size}-{shape}-{stone}.webp`
  - `size`: `single` (jednohrob), `double` (dvojhrob)
  - `shape`: `rect` (rovný), `arch` (oblúk), `book` (kniha)
  - `stone`: `black` (čierna), `gray` (sivá), `red` (červenohnedá)
- Vzorky písma: `assets/images/lettering/{stone}-{letter}.webp`
  - `letter`: `gold` (zlatá), `silver` (strieborná), `white` (biela)

> Oproti staršej verzii sú odstránené: **urnový** rozmer, **svetlá žula**, „moderný/zrezaný" tvar a **tmavé** písmo
> (pre tieto kombinácie nie sú fotky). SVG vizualizácia bola nahradená fotkami.

## Nastavenia (na začiatku `<script>` v `index.html`)
```js
var CONFIG = {
  brand:'Kamenárstvo Jantár',
  phone:'+421900000000', phoneTxt:'+421 900 000 000',
  email:'info@kamenarstvojantar.sk',
  whatsapp:'421900000000',                 // medzinárodný formát bez +
  privacyUrl:'#',                          // odkaz na zásady ochrany údajov
  assetBase:'assets/images/',             // cesta k fotkám
  chatApiUrl:'',                          // voliteľný AI backend (Anthropic proxy na Verceli)
  emailjs:{ publicKey:'', serviceId:'', templateId:'' } // voliteľný EmailJS
};
```
- Ak `chatApiUrl` ostane prázdne, beží **lokálny** asistent (odpovedá na kameň, veľkosť, nápis, údržbu, termín…).
- Ak `emailjs` ostane prázdne, dopyt sa odošle cez predvyplnený **e-mail** (alebo WhatsApp).

## Nasadenie (GitHub Pages)
Repo obsahuje `.nojekyll`, takže priečinok `assets/` sa publikuje správne.
V *Settings → Pages* nastavte zdroj na vetvu `main` (root). Widget pobeží na
`https://<účet>.github.io/kamenarstvo/`. Náhľad: pridajte `?preview=1` (panel sa otvorí sám).

## Vloženie do stránky (iframe)
```html
<iframe src="https://<účet>.github.io/kamenarstvo/?preview=1"
        style="position:fixed;inset:auto 0 0 auto;width:470px;height:760px;border:0;z-index:99999"
        title="Kamenárstvo Jantár"></iframe>
```
Mimo otvoreného okna ostáva web klikateľný (widget je vpravo dole).
