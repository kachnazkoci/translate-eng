let all = [];
let mode = "match";
let selected = null;
let score = 0;
let remaining = [];

const $ = (selector) => document.querySelector(selector);

async function init() {
    const response = await fetch("vocabulary.csv");
    if (!response.ok) throw new Error("Could not load vocabulary.csv.");
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

    setOptions(
        $("#book"),
        unique(all.map(x => x.book)).map(book => ({ value: book, label: book })),
        "All books"
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

function setOptions(select, options, allLabel = "All") {
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

    const parts = [];
    const seenParts = new Set();

    for (const item of data) {
        if (!item.part || seenParts.has(item.part)) continue;
        seenParts.add(item.part);

        if (item.part === "Introduction") {
            parts.push({ value: "Introduction", label: "Introduction" });
        } else {
            parts.push({
                value: item.part,
                label: `${item.part} — ${item.partName}`
            });
        }
    }

    setOptions($("#part"), parts, "All parts");
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

    setOptions($("#block"), blocks, "All chapters / blocks");
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
    $("#count").textContent = `${data.length} words`;
    start(true);
}

function sample(array, count) {
    return shuffle(array).slice(0, count);
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
    } else if (mode === "translate") {
        renderTranslate();
    } else {
        renderPick();
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

        showCompletion();
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
            <b>Score: ${score}</b>
            <span>${progressStart}–${progressEnd} / ${sessionTotal}</span>
        </div>

        <p class="muted">
            Click an English or Czech expression, then click its counterpart.
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
        selected.classList.remove("selected");
        selected = null;
        return;
    }

    const first = selected;
    const second = button;

    if (first.dataset.id === second.dataset.id) {
        first.classList.remove("selected");
        first.classList.add("correct");
        second.classList.add("correct");

        score++;
        remaining = remaining.filter(x => x.id !== second.dataset.id);
        selected = null;

        setTimeout(() => render(), 450);
    } else {
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
        if (deck.length > 0) {
            remaining = deck.splice(0, Math.min(5, deck.length));
            renderTranslate();
            return;
        }

        showCompletion();
        return;
    }

    const item = remaining[0];
    const englishFirst = Math.random() < 0.5;
    const prompt = englishFirst ? item.en : item.cz;

    const completed = sessionTotal - deck.length - remaining.length;

    $("#game").innerHTML = `
        <div class="score">
            <b>Score: ${score}</b>
            <span>${completed + 1}/${sessionTotal}</span>
        </div>

        <div class="prompt">${esc(prompt)}</div>

        <div class="answer">
            <input id="ans" autofocus placeholder="${englishFirst ? "Czech" : "English"}">
            <button id="check">Check</button>
        </div>

        <p id="fb" class="muted"></p>
    `;

    const check = () => {
        const value = $("#ans").value.trim();
        if (!value) return;

        const target = englishFirst ? item.cz : item.en;
        const accepted = getAcceptedAnswers(target);

        if (accepted.some(answer => answersMatch(answer, value))) {
            score++;
            $("#fb").textContent = "✓ Correct";
            $("#fb").className = "feedback correct-text";
        } else {
            $("#fb").textContent = `✗ ${target}`;
            $("#fb").className = "feedback wrong-text";
        }

        $("#check").disabled = true;
        remaining.shift();

        setTimeout(renderTranslate, 500);
    };

    $("#check").onclick = check;
    $("#ans").onkeydown = event => {
        if (event.key === "Enter") check();
    };

    requestAnimationFrame(() => {
        const input = $("#ans");
        if (input) {
            input.focus();
            input.select();
        }
    });
}

function renderPick() {
    if (!remaining.length) {
        if (deck.length > 0) {
            remaining = deck.splice(0, Math.min(5, deck.length));
            renderPick();
            return;
        }

        showCompletion();
        return;
    }

    const item = remaining[0];
    const englishFirst = Math.random() < 0.5;
    const prompt = englishFirst ? item.en : item.cz;

    // Five options are always taken from the currently selected block/filter.
    // The correct answer is guaranteed to be included, then the other four
    // options are selected from the same filtered pool.
    const pool = filtered().filter(x => x.id !== item.id);
    const distractors = sample(pool, Math.min(4, pool.length));
    const options = shuffle([item, ...distractors]);

    const completed = sessionTotal - deck.length - remaining.length;

    $("#game").innerHTML = `
        <div class="score">
            <b>Score: ${score}</b>
            <span>${completed + 1}/${sessionTotal}</span>
        </div>

        <p class="pick-label">Pick the right one:</p>
        <div class="pick-prompt">${esc(prompt)}</div>

        <div class="choices">
            ${options.map(option => `
                <button class="choice" data-id="${esc(option.id)}">
                    ${esc(englishFirst ? option.cz : option.en)}
                </button>
            `).join("")}
        </div>

        <p id="pick-feedback" class="feedback"></p>
    `;

    document.querySelectorAll(".choice").forEach(button => {
        button.onclick = () => pickAnswer(button, item.id);
    });
}

function pickAnswer(button, correctId) {
    const buttons = document.querySelectorAll(".choice");
    buttons.forEach(x => x.disabled = true);

    const feedback = $("#pick-feedback");

    if (button.dataset.id === String(correctId)) {
        button.classList.add("correct");
        feedback.textContent = "✓ Correct";
        feedback.className = "feedback correct-text";
        score++;
    } else {
        button.classList.add("wrong");
        feedback.textContent = "✗ Wrong";
        feedback.className = "feedback wrong-text";

        const correctButton = [...buttons].find(x => x.dataset.id === String(correctId));
        if (correctButton) correctButton.classList.add("correct");
    }

    remaining.shift();
    setTimeout(renderPick, 650);
}

function getAcceptedAnswers(text) {
    return String(text ?? "")
        .split(";")
        .map(answer => answer.trim())
        .filter(Boolean);
}

function normalizeAnswer(text) {
    return String(text ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function answersMatch(a, b) {
    return normalizeAnswer(a) === normalizeAnswer(b);
}

function showCompletion() {
    const blockValue = $("#block").value;
    const blockLabel = $("#block option:checked")?.textContent || blockValue;

    let trainingText;
    if (/^\d+$/.test(blockValue)) {
        trainingText = `Chapter ${blockValue}`;
    } else {
        trainingText = blockLabel;
    }

    $("#game").innerHTML = `
        <div class="result">
            <h2>Complete round 🎉</h2>
            <p>All ${sessionTotal} words from ${trainingText} have been practiced.</p>
            <button onclick="start(true)">New round</button>
        </div>
    `;
}

document.querySelectorAll(".tab").forEach(button => {
    button.onclick = () => {
        document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
        button.classList.add("active");
        mode = button.dataset.mode;
        start(true);
    };
});

$("#book").onchange = updateFilters;
$("#part").onchange = updateBlocks;
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

init().catch(error => {
    $("#count").textContent = "Error";
    $("#game").innerHTML = `
        <div class="result">
            <h2>Could not load vocabulary</h2>
            <p>${esc(error.message)}</p>
        </div>
    `;
});
