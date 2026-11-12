let all = [];
let mode = "match";
let selected = null;
let score = 0;
let remaining = [];

const $ = (selector) => document.querySelector(selector);

async function init() {
    const csv = await (await fetch("vocabulary.csv")).text();
    const rows = parseCSV(csv);

    // CSV columns:
    // ID, Kniha, Část, Název části, Blok, Kapitola,
    // Název kapitoly, Anglický výraz, Český překlad, ...
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

    setOptions(
        $("#book"),
        unique(all.map(x => x.book)),
        "Všechny knihy"
    );

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

        if (char === ',' && !quoted) {
            row.push(cell);
            cell = "";
            continue;
        }

        if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && next === '\n') i++;
            row.push(cell);
            cell = "";

            if (row.some(value => value !== "")) {
                result.push(row);
            }

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

function setOptions(select, values, allLabel = "Vše") {
    const current = select.value;

    select.innerHTML = `<option value="">${esc(allLabel)}</option>` +
        values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");

    if (values.includes(current)) {
        select.value = current;
    }
}

function updateFilters() {
    const oldPart = $("#part").value;
    const oldBlock = $("#block").value;

    // Part depends on the selected book.
    let data = all;

    if ($("#book").value) {
        data = data.filter(x => x.book === $("#book").value);
    }

    const parts = unique(data.map(x =>
        x.partName ? `${x.part} – ${x.partName}` : x.part
    ));

    setOptions($("#part"), parts, "Všechny části");

    // Keep the previous Part selection if it is still valid.
    if (parts.includes(oldPart)) {
        $("#part").value = oldPart;
    } else {
        $("#part").value = "";
    }

    updateBlocks(oldBlock);
}

function updateBlocks(oldBlock = "") {
    let data = all;

    if ($("#book").value) {
        data = data.filter(x => x.book === $("#book").value);
    }

    if ($("#part").value) {
        const selectedPart = $("#part").value;
        data = data.filter(x => {
            const label = x.partName ? `${x.part} – ${x.partName}` : x.part;
            return label === selectedPart;
        });
    }

    const blocks = unique(data.map(x => getBlockLabel(x)));

    setOptions($("#block"), blocks, "Všechny kapitoly / bloky");

    if (blocks.includes(oldBlock)) {
        $("#block").value = oldBlock;
    } else {
        $("#block").value = "";
    }

    updateCountAndStart();
}

function getBlockLabel(item) {
    // Solutions are a separate selectable block.
    if (item.block && item.block.toLowerCase() === "solutions") {
        return "Solutions";
    }

    if (item.chapterName) {
        return item.chapter
            ? `${item.chapter} – ${item.chapterName}`
            : item.chapterName;
    }

    if (item.chapter) {
        return item.chapter;
    }

    return item.block || "Ostatní";
}

function filtered() {
    let data = all;

    if ($("#book").value) {
        data = data.filter(x => x.book === $("#book").value);
    }

    if ($("#part").value) {
        const selectedPart = $("#part").value;
        data = data.filter(x => {
            const label = x.partName ? `${x.part} – ${x.partName}` : x.part;
            return label === selectedPart;
        });
    }

    if ($("#block").value) {
        data = data.filter(x => getBlockLabel(x) === $("#block").value);
    }

    return data;
}

function updateCountAndStart() {
    const data = filtered();
    $("#count").textContent = `${data.length} slovíček`;
    start();
}

function sample(array, count) {
    return [...array]
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
}

function start() {
    score = 0;
    remaining = sample(filtered(), 20);
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

    if (selected.dataset.id === button.dataset.id) {
        selected.classList.remove("selected");
        selected.classList.add("correct");
        button.classList.add("correct");

        score++;
        remaining = remaining.filter(x => x.id !== button.dataset.id);

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
    const englishToCzech = Math.random() < 0.5;
    const total = Math.min(20, filtered().length);
    const done = total - remaining.length;

    $("#game").innerHTML = `
        <div class="score">
            <b>Skóre: ${score}</b>
            <span>${Math.min(done + 1, total)}/${total}</span>
        </div>

        <div class="prompt">
            ${esc(englishToCzech ? item.en : item.cz)}
        </div>

        <div class="answer">
            <input
                id="ans"
                autofocus
                placeholder="${englishToCzech ? "Česky" : "English"}"
            >
            <button id="check">Kontrola</button>
        </div>

        <p id="fb" class="muted"></p>
    `;

    const check = () => {
        const value = $("#ans").value.trim().toLowerCase();
        const target = englishToCzech ? item.cz : item.en;
        const accepted = target
            .toLowerCase()
            .split(";")
            .map(x => x.trim());

        if (accepted.includes(value) || value === target.toLowerCase()) {
            score++;
            $("#fb").textContent = "✓ Správně";
        } else {
            $("#fb").textContent = `✗ ${englishToCzech ? item.cz : item.en}`;
        }

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
        document.querySelectorAll(".tab")
            .forEach(tab => tab.classList.remove("active"));

        button.classList.add("active");
        mode = button.dataset.mode;
        start();
    };
});

$("#book").onchange = () => {
    $("#part").value = "";
    $("#block").value = "";
    updateFilters();
};

$("#part").onchange = () => {
    $("#block").value = "";
    updateBlocks();
};

$("#block").onchange = updateCountAndStart;

$("#reset").onclick = () => {
    $("#book").value = "";
    $("#part").value = "";
    $("#block").value = "";
    updateFilters();
};

function esc(value) {
    return String(value ?? "").replace(/[&<>\"]/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[char]));
}

init();
