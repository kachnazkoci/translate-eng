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
        } else if (item.block === "Solutions") {
            value = "Solutions";
            label = "Solutions";
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
            if (x.block === "Solutions") return $("#block").value === "Solutions";
            return x.chapter === $("#block").value;
        });
    }

    return data;
}

function updateCountAndStart() {
    const data = filtered();
    $("#count").textContent = `${data.length} slovíček`;
    start();
}

function sample(array, count) {
    return [...array].sort(() => Math.random() - 0.5).slice(0, count);
}

function start() {
    score = 0;
    selected = null;
    remaining = sample(filtered(), Math.min(20, filtered().length));
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
    const round = remaining.slice(0, 5);

    if (!round.length) {
        $("#game").innerHTML = `
            <div class="result">
                <h2>Hotovo 🎉</h2>
                <p>Skóre: ${score}</p>
                <button onclick="start()">Hrát znovu</button>
            </div>
        `;
        return;
    }

    selected = null;

    const english = sample(round, round.length);
    const czech = sample(round, round.length);
    const total = Math.min(20, filtered().length);
    const done = total - remaining.length;

    $("#game").innerHTML = `
        <div class="score">
            <b>Skóre: ${score}</b>
            <span>${Math.min(done + 1, total)}/${total}</span>
        </div>

        <p class="muted">
            Klikni na anglické slovo a potom na jeho český překlad.
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

    if (!selected) {
        selected = button;
        selected.classList.add("selected");
        return;
    }

    if (selected === button) {
        return;
    }

    if (selected.dataset.id === button.dataset.id) {
        selected.classList.remove("selected");
        selected.classList.add("correct");
        button.classList.add("correct");

        score++;
        remaining = remaining.filter(x => x.id !== button.dataset.id);
        selected = null;

        if (remaining.length % 5 === 0 || remaining.length === 0) {
            setTimeout(render, 300);
        }
    } else {
        selected.classList.remove("selected");
        selected = null;
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
