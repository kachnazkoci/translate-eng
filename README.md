# Slovíčková hra – GitHub Pages

Webová verze původní Python/Tkinter aplikace. Nepotřebuje Python ani instalaci.

## Soubory
- `index.html` – vstupní stránka
- `style.css` – vzhled a responzivní rozložení
- `app.js` – herní logika
- `slovicka.xlsx` – databáze slovíček, zachovává původní list `Slovník` a jeho sloupce

## Publikování
1. Vytvoř nové GitHub repository, například `slovickova-hra`.
2. Nahraj všechny čtyři soubory do kořenové složky repository.
3. Otevři **Settings → Pages**.
4. V části **Build and deployment** vyber **Deploy from a branch**.
5. Nastav branch `main` a složku `/(root)`, potvrď **Save**.
6. Po publikování se zobrazí adresa webu, obvykle `https://TVUJ-UCET.github.io/slovickova-hra/`.

## Aktualizace slovíček
Uprav `slovicka.xlsx`, list `Slovník`, stejně jako dosud. Zachovej názvy sloupců a jedinečná ID. Potom nahraď soubor v kořenové složce GitHub repository. Není nutné měnit JavaScript ani HTML; po obnovení stránky se načte nový Excel.

## Hraní
- Přiřazování: dvojice po pěti, nejvýše 20 různých slov v jednom kole.
- Přímý překlad: až 20 slov, náhodný směr EN → CZ nebo CZ → EN.
- Filtr kategorií; české varianty oddělené středníkem jsou přijímány.

**Poznámka:** knihovna pro čtení Excelu se načítá z CDN SheetJS, takže web při načítání potřebuje internet. Excel zůstává uložený přímo v repository.
