let all = [];
let mode = "match";
let selected = null;
let score = 0;
let remaining = [];

const $ = (selector) => document.querySelector(selector);

async function init() {
    const response = await fetch("vocabulary.csv");
    if (!response.ok) throw new Error("Nepodařilo se načíst vocabulary.csv.");
    const csv = await response.text();
    const rows = parseCSV(csv);

    all = rows.slice(1)
        .filter(row => row[7] && row[8])
        .map(row => ({
            id: row[0],
            book: row[1],
            part: row[2],
            partName: row[3],
            block: row[4],
            chapter: row[5],
            chapterName: row[6],
            en: row[7],
            cz: row[8]
        }));

    setOptions($("#book"), unique(all.map(x => x.book)), "Vše");
    updateFilters();
}

function parseCSV(text) {
    const result = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && quoted && next === '"') {
            cell += '"';
            i++;
            continue;
        }

        if (char === '"') {
            quoted = !quoted;
            continue;
        }

        if (char === "," && !quoted) {
            row.push(cell);
            cell = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && next === "\n") i++;
            row.push(cell);
            cell = "";

            if (row.some(value => value !== "")) result.push(row);
            row = [];
            continue;
        }

        cell += char;
    }

    if (cell !== "" || row.length) {
        row.push(cell);
        result.push(row);
    }

    return result;
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function setOptions(select, options, allLabel = "Vše") {
    select.innerHTML =
        `<option value="">${esc(allLabel)}</option>` +
        options.map(option =>
            `<option value="${esc(option.value)}">${esc(option.label)}</option>`
        ).join("");
}

function updateFilters() {
    const selectedBook = $("#book").value;

    let data = all;
    if (selectedBook) {
        data = data.filter(x => x.book === selectedBook);
    }

    // IMPORTANT:
    // The Part selector contains only Introduction / Part 1 / Part 2...
    // It must never contain the raw numeric value "1" as a second option.
    const parts = [];
    const seenParts = new Set();

    for (const item of data) {
        if (!item.part || seenParts.has(item.part)) continue;
        seenParts.add(item.part);

        if (item.part === "Introduction") {
            parts.push({
                value: "Introduction",
                label: "Introduction"
            });
        } else {
            parts.push({
                value: item.part,
                label: `${item.part} — ${item.partName}`
            });
        }
    }

    setOptions($("#part"), parts, "Vše");
    updateBlocks();
}

function updateBlocks() {
    const selectedBook = $("#book").value;
    const selectedPart = $("#part").value;

    let data = all;

    if (selectedBook) {
        data = data.filter(x => x.book === selectedBook);
    }

    if (selectedPart) {
        data = data.filter(x => x.part === selectedPart);
    }

    const blocks = [];
    const seenBlocks = new Set();

    for (const item of data) {
        let value;
        let label;

        if (item.part === "Introduction") {
            value = "Introduction";
            label = "Introduction";
        } else if (item.block && item.block.toLowerCase().startsWith("solutions")) {
            // Keep Solutions 1 / Solutions 2 / Solutions 3 as separate blocks.
            value = item.block;
            label = item.block;
        } else {
            value = item.chapter;
            label = item.chapter
                ? `Chapter ${item.chapter} — ${item.chapterName}`
                : item.chapterName;
        }

        if (!value || seenBlocks.has(value)) continue;
        seenBlocks.add(value);
        blocks.push({ value, label });
    }

    setOptions($("#block"), blocks, "Vše");
    updateCountAndStart();
}

function filtered() {
    let data = all;

    if ($("#book").value) {
        data = data.filter(x => x.book === $("#book").value);
    }

    if ($("#part").value) {
        data = data.filter(x => x.part === $("#part").value);
    }

    if ($("#block").value) {
        data = data.filter(x => {
            if (x.part === "Introduction") return $("#block").value === "Introduction";
            if (x.block && x.block.toLowerCase().startsWith("solutions")) {
                return x.block === $("#block").value;
            }
            return x.chapter === $("#block").value;
        });
    }

    return data;
}

function updateCountAndStart() {
    const data = filtered();
    $("#count").textContent = `${data.length} slovíček`;
    start(true);
}

function sample(array, count) {
    return [...array].sort(() => Math.random() - 0.5).slice(0, count);
}

let deck = [];
let sessionKey = "";
let sessionTotal = 0;

function getSessionKey() {
    return [
        $("#book").value,
        $("#part").value,
        $("#block").value
    ].join("|");
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function start(forceNewCycle = false) {
    const key = getSessionKey();
    const data = filtered();

    if (key !== sessionKey || forceNewCycle || deck.length === 0) {
        sessionKey = key;
        deck = shuffle(data);
        sessionTotal = data.length;
    }

    score = 0;
    selected = null;
    remaining = deck.splice(0, Math.min(5, deck.length));

    render();
}

function render() {
    if (mode === "match") {
        renderMatch();
    } else {
        renderTranslate();
    }
}

function renderMatch() {
    const round = remaining;

    if (!round.length) {
        if (deck.length > 0) {
            remaining = deck.splice(0, Math.min(5, deck.length));
            selected = null;
            render();
            return;
        }

        const blockValue = $("#block").value;
        const blockLabel = $("#block option:checked")?.textContent || blockValue;

        let trainingText;
        if (/^\\d+$/.test(blockValue)) {
            trainingText = `${blockValue}. kapitoly`;
        } else {
            trainingText = blockLabel;
        }

        $("#game").innerHTML = `
            <div class="result">
                <h2>Celé kolo dokončeno 🎉</h2>
                <p>Bylo potrénováno všech ${sessionTotal} slovíček ${trainingText}.</p>
                <button onclick="start(true)">Nové kolo</button>
            </div>
        `;
        return;
    }

    selected = null;

    const english = shuffle(round);
    const czech = shuffle(round);

    const completed = sessionTotal - deck.length - remaining.length;
    const progressStart = completed + 1;
    const progressEnd = completed + round.length;

    $("#game").innerHTML = `
        <div class="score">
            <b>Skóre: ${score}</b>
            <span>${progressStart}–${progressEnd} / ${sessionTotal}</span>
        </div>

        <p class="muted">
            Klikni na anglický nebo český výraz a potom na jeho protějšek.
        </p>

        <div class="round">
            <div>
                ${english.map(x => `
                    <button class="word" data-id="${esc(x.id)}">
                        ${esc(x.en)}
                    </button>
                `).join("")}
            </div>

            <div>
                ${czech.map(x => `
                    <button class="word" data-id="${esc(x.id)}">
                        ${esc(x.cz)}
                    </button>
                `).join("")}
            </div>
        </div>
    `;

    document.querySelectorAll(".word").forEach(button => {
        button.onclick = pair;
    });
}

function pair(event) {
    const button = event.currentTarget;

    // První klik může být na anglický i český výraz.
    if (!selected) {
        selected = button;
        selected.classList.add("selected");
        return;
    }

    // Kliknutí na stejný výraz podruhé zruší výběr.
    if (selected === button) {
        selected.classList.remove("selected");
        selected = null;
        return;
    }

    const first = selected;
    const second = button;

    // Pořadí jazyků není důležité.
    if (first.dataset.id === second.dataset.id) {
        // SPRÁVNĚ – zelené označení a dvojice následně zmizí.
        first.classList.remove("selected");
        first.classList.add("correct");
        second.classList.add("correct");

        score++;
        remaining = remaining.filter(x => x.id !== second.dataset.id);
        selected = null;

        // Necháme uživatele krátce vidět zelenou správnou odpověď,
        // potom dvojice zmizí.
        setTimeout(() => {
            render();
        }, 450);

    } else {
        // ŠPATNĚ – obě kliknuté karty se krátce označí červeně.
        // Dvojice zůstane na místě, aby bylo jasné, co bylo špatně.
        first.classList.remove("selected");
        first.classList.add("wrong");
        second.classList.add("wrong");

        setTimeout(() => {
            first.classList.remove("wrong");
            second.classList.remove("wrong");
            selected = null;
        }, 700);
    }
}

function renderTranslate() {
    if (!remaining.length) {
        $("#game").innerHTML = `
            <div class="result">
                <h2>Hotovo 🎉</h2>
                <p>Skóre: ${score}</p>
                <button onclick="start()">Hrát znovu</button>
            </div>
        `;
        return;
    }

    const item = remaining[0];
    const englishFirst = Math.random() < 0.5;
    const prompt = englishFirst ? item.en : item.cz;

    $("#game").innerHTML = `
        <div class="score">
            <b>Skóre: ${score}</b>
            <span>${Math.min(20 - remaining.length + 1, 20)}/${Math.min(20, filtered().length)}</span>
        </div>

        <div class="prompt">${esc(prompt)}</div>

        <div class="answer">
            <input id="ans" autofocus placeholder="${englishFirst ? "Česky" : "English"}">
            <button id="check">Kontrola</button>
        </div>

        <p id="fb" class="muted"></p>
    `;

    const check = () => {
        const value = $("#ans").value.trim().toLowerCase();
        if (!value) return;

        const accepted = englishFirst
            ? item.cz.toLowerCase().split(";").map(x => x.trim())
            : [item.en.toLowerCase().trim()];

        if (accepted.includes(value)) {
            score++;
            $("#fb").textContent = "✓ Správně";
        } else {
            $("#fb").textContent = `✗ ${englishFirst ? item.cz : item.en}`;
        }

        $("#check").disabled = true;
        remaining.shift();

        setTimeout(renderTranslate, 500);
    };

    $("#check").onclick = check;
    $("#ans").onkeydown = event => {
        if (event.key === "Enter") check();
    };

    // The input is recreated for every new word, so autofocus alone
    // is not reliable after dynamic DOM updates. Explicitly focus it.
    requestAnimationFrame(() => {
        const input = $("#ans");
        if (input) {
            input.focus();
            input.select();
        }
    });
}

document.querySelectorAll(".tab").forEach(button => {
    button.onclick = () => {
        document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
        button.classList.add("active");
        mode = button.dataset.mode;
        start();
    };
});

$("#book").onchange = updateFilters;
$("#part").onchange = updateBlocks;
$("#block").onchange = updateCountAndStart;

$("#reset").onclick = () => {
    $("#book").value = "";
    updateFilters();
};

function esc(value) {
    return String(value ?? "").replace(/[&<>"]/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[char]));
}

init().catch(error => {
    $("#count").textContent = "Chyba";
    $("#game").innerHTML = `
        <div class="result">
            <h2>Nepodařilo se načíst slovíčka</h2>
            <p>${esc(error.message)}</p>
        </div>
    `;
});
