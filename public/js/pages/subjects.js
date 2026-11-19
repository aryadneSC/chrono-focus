import { registerPageSetup } from "./router.js";
import { pageType } from "../util/enum.js";
import { plan, invalidateSchedule } from "../state/scheduleState.js";

let editingId = null;
let topicSubjectId = null;
let editingTopicId = null;
let renderCurrentList = () => {};
let dialogsInitialized = false;
let subjectValidationRequested = false;

function validateSubjectForm() {
    const form = document.querySelector("#subject-form");
    const name = form.elements["subject-name"].value.trim();
    const importance = form.elements.importance.value;
    const difficulty = form.elements.difficulty.value;
    const errors = {
        name: name ? "" : "Digite um nome para a matéria.",
        importance: ["low", "medium", "high"].includes(importance) ? "" : "Escolha a importância da matéria.",
        difficulty: ["low", "medium", "high"].includes(difficulty) ? "" : "Escolha a dificuldade da matéria.",
    };
    for (const [field, message] of Object.entries(errors)) {
        document.querySelector(`#subject-${field}-error`).textContent = message;
        const inputs = field === "name" ? [form.elements["subject-name"]] : [...form.querySelectorAll(`input[name="${field}"]`)];
        inputs.forEach((input) => input.setAttribute("aria-invalid", String(Boolean(message))));
    }
    document.querySelector("#subjects-error").textContent = Object.values(errors).filter(Boolean).join(" ");
    return errors;
}

import { getTopics, normalizeTopics, topicStatus, changeTopicStatus, subjectCompleted } from "../util/topics.js";
import { refreshFutureSchedule } from "../state/scheduleService.js";
import { localDateValue } from "../util/dates.js";

function formatDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

export function showSubjectEditor(id = null) {
    const dialog = document.querySelector("#subject-dialog");
    const form = document.querySelector("#subject-form");
    const subject = plan.subjects.find((item) => item.id === id);
    editingId = subject?.id || null;
    form.reset();
    subjectValidationRequested = false;
    for (const field of ["name", "importance", "difficulty"]) document.querySelector(`#subject-${field}-error`).textContent = "";
    form.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
    document.querySelector("#subject-dialog-title").textContent = subject ? "Editar" : "Nova matéria";
    document.querySelector("#subject-submit").textContent = subject ? "Salvar" : "Adicionar";
    if (subject) {
        form.elements["subject-name"].value = subject.name;
        form.elements["subject-deadline"].value = subject.deadline || "";
        const importance = subject.importance || subject.priority;
        const importanceRadio = [...form.querySelectorAll('input[name="importance"]')].find((input) => input.value === importance);
        if (importanceRadio) importanceRadio.checked = true;
        const difficultyRadio = [...form.querySelectorAll('input[name="difficulty"]')].find((input) => input.value === subject.difficulty);
        if (difficultyRadio) difficultyRadio.checked = true;
    }
    dialog.showModal();
    form.elements["subject-name"].focus();
}

function showTopicEditor(subjectId, topicId = null) {
    const subject = plan.subjects.find((item) => item.id === subjectId);
    if (!subject) return;

    topicSubjectId = subject.id;
    editingTopicId = topicId;
    const form = document.querySelector("#topic-form");
    form.reset();
    if (topicId !== null) form.elements["topic-name"].value = getTopics(subject).find((topic) => topic.id === topicId)?.name || "";
    document.querySelector("#topic-dialog-title").textContent = `Assuntos de ${subject.name}`;
    document.querySelector("#topic-confirmation").classList.add("hidden");
    document.querySelector("#topic-error").textContent = "";
    document.querySelector("#topic-dialog").showModal();
    form.elements["topic-name"].focus();
}

function setupDialogs() {
    const subjectDialog = document.querySelector("#subject-dialog");
    const subjectForm = document.querySelector("#subject-form");
    const topicDialog = document.querySelector("#topic-dialog");
    const topicForm = document.querySelector("#topic-form");
    const topicInput = topicForm.elements["topic-name"];

    document.querySelector("#subject-dialog-cancel").addEventListener("click", () => subjectDialog.close());
    document.querySelector("#topic-dialog-close").addEventListener("click", () => topicDialog.close());
    topicInput.addEventListener("input", () => {
        document.querySelector("#topic-confirmation").classList.add("hidden");
        document.querySelector("#topic-error").textContent = "";
    });

    subjectDialog.addEventListener("click", (event) => {
        if (event.target !== subjectDialog) return;
        const bounds = subjectDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            subjectDialog.close();
        }
    });
    subjectDialog.addEventListener("close", () => {
        editingId = null;
        subjectForm.reset();
        document.querySelector("#subject-name-error").textContent = "";
    });
    topicDialog.addEventListener("close", () => {
        topicSubjectId = null;
        topicForm.reset();
        document.querySelector("#topic-confirmation").classList.add("hidden");
        document.querySelector("#topic-error").textContent = "";
    });

    subjectForm.addEventListener("input", () => {
        if (subjectValidationRequested) validateSubjectForm();
    });
    subjectForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(subjectForm);
        const name = String(data.get("subject-name") || "").trim();
        const nameInput = subjectForm.elements["subject-name"];
        subjectValidationRequested = true;
        const errors = validateSubjectForm();
        if (Object.values(errors).some(Boolean)) {
            if (errors.name) nameInput.focus();
            else subjectForm.querySelector(`input[name="${errors.importance ? "importance" : "difficulty"}"]`).focus();
            return;
        }

        const previous = plan.subjects.find((item) => item.id === editingId);
        const subject = {
            id: editingId || crypto.randomUUID(),
            name,
            importance: String(data.get("importance") || ""),
            difficulty: String(data.get("difficulty") || ""),
            deadline: String(data.get("subject-deadline") || ""),
            topics: previous ? getTopics(previous, true) : [],
        };
        if (editingId) {
            const index = plan.subjects.findIndex((item) => item.id === editingId);
            if (index >= 0) plan.subjects[index] = subject;
        } else {
            plan.subjects.push(subject);
        }

        invalidateSchedule();
        subjectDialog.close();
        document.querySelector("#subjects-error").textContent = "";
        renderCurrentList();
        const recalculatePrompt = document.querySelector("#schedule-recalculate-prompt");
        if (recalculatePrompt) {
            recalculatePrompt.classList.toggle("hidden", !plan.schedule.length);
        }
    });

    topicForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const subject = plan.subjects.find((item) => item.id === topicSubjectId);
        const topic = String(topicInput.value || "").trim();
        if (!subject || !topic) {
            document.querySelector("#topic-error").textContent = "Digite um assunto para adicionar.";
            topicInput.focus();
            return;
        }

        normalizeTopics(subject);
        if (editingTopicId === null) subject.topics.push({ id: crypto.randomUUID(), name: topic, events: [] });
        else {
            const existing = subject.topics.find((item) => item.id === editingTopicId);
            if (existing) existing.name = topic;
        }
        invalidateSchedule();
        delete subject.topic;
        topicInput.value = "";
        document.querySelector("#topic-confirmation").textContent = `“${topic}” foi adicionado a ${subject.name}.`;
        document.querySelector("#topic-confirmation").classList.remove("hidden");
        document.querySelector("#topic-error").textContent = "";
        renderCurrentList();
        if (editingTopicId !== null) topicDialog.close();
        else topicInput.focus();
    });
}

function setupSubjects() {
    const addButton = document.querySelector("#add-subject");
    const list = document.querySelector("#subjects-list");
    const hint = document.querySelector("#subjects-hint");

    function renderList() {
        list.replaceChildren();
        list.classList.toggle("hidden", plan.subjects.length === 0);
        hint?.classList.toggle("hidden", plan.subjects.length >= 2);
        addButton.textContent = plan.subjects.length ? "+ Adicionar matéria" : "+ Adicione sua primeira matéria";

        plan.subjects.forEach((subject) => {
            normalizeTopics(subject);
            const item = document.createElement("article");
            item.className = "card-column card-accent subject-list-item";

            const headingRow = document.createElement("div");
            headingRow.className = "subject-heading-row";
            const heading = document.createElement("h3");
            heading.textContent = subject.name;
            headingRow.append(heading);
            if (subject.deadline) {
                const deadline = document.createElement("p");
                deadline.className = "badge-text";
                deadline.textContent = `Prazo: ${formatDate(subject.deadline)}`;
                headingRow.append(deadline);
            }

            const addTopicButton = document.createElement("button");
            addTopicButton.type = "button";
            addTopicButton.className = "btn btn-secondary subject-topic-add";
            addTopicButton.textContent = "+";
            addTopicButton.dataset.action = "add-topic";
            addTopicButton.dataset.subjectId = subject.id;
            addTopicButton.setAttribute("aria-label", `Adicionar assunto a ${subject.name}`);
            headingRow.append(addTopicButton);
            item.append(headingRow);
            const actions = document.createElement("div");
            actions.className = "review-actions";
            for (const [action, label] of [["edit-subject", "Editar"], ["remove-subject", "Excluir"]]) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "btn btn-terciary";
                button.dataset.action = action;
                button.dataset.subjectId = subject.id;
                button.textContent = label;
                button.setAttribute("aria-label", `${label} ${subject.name}`);
                actions.append(button);
            }
            item.append(actions);

            const topics = getTopics(subject, true).filter((topic) => !topic.archived);
            if (topics.length > 0) {
                const topicList = document.createElement("ol");
                topicList.className = "subject-topics";
                topics.forEach((topic) => {
                    const topicItem = document.createElement("li");
                    const completed = topicStatus(topic).completed;
                    topicItem.classList.toggle("topic-completed", completed);
                    topicItem.textContent = `${topic.name}${completed ? " · Concluído" : ""}`;
                    for (const [action, label] of [["edit-topic", "Editar"], ["remove-topic", "Excluir"]]) {
                        const button = document.createElement("button");
                        button.type = "button";
                        button.className = "btn btn-terciary";
                        button.textContent = label;
                        button.dataset.action = action;
                        button.dataset.subjectId = subject.id;
                        button.dataset.topicId = topic.id;
                        button.setAttribute("aria-label", `${label} assunto ${topic.name}`);
                        topicItem.append(button);
                    }
                    if (completed && document.querySelector('nav [data-page-link="subjects"]')) {
                        const resume = document.createElement("button");
                        resume.type = "button";
                        resume.className = "btn btn-secondary";
                        resume.textContent = "Retomar assunto";
                        resume.dataset.action = "reopen-topic";
                        resume.dataset.subjectId = subject.id;
                        resume.dataset.topicId = topic.id;
                        topicItem.append(resume);
                    }
                    topicList.append(topicItem);
                });
                item.append(topicList);
            } else {
                const emptyTopics = document.createElement("p");
                emptyTopics.textContent = "Nenhum assunto adicionado.";
                item.append(emptyTopics);
            }
            list.append(item);
        });
        document.querySelector("#schedule-recalculate-prompt")?.classList.toggle("hidden", !plan.schedule.length || plan.scheduleGenerated);
    }

    renderCurrentList = renderList;
    addButton.addEventListener("click", () => showSubjectEditor());
    list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const subject = plan.subjects.find((item) => item.id === button.dataset.subjectId);
        if (!subject) return;
        if (button.dataset.action === "add-topic") showTopicEditor(subject.id);
        if (button.dataset.action === "edit-topic") showTopicEditor(subject.id, button.dataset.topicId);
        if (button.dataset.action === "reopen-topic") {
            const wasComplete = subjectCompleted(subject);
            changeTopicStatus(subject, button.dataset.topicId, false, localDateValue());
            refreshFutureSchedule(new Date(), wasComplete !== subjectCompleted(subject));
            renderList();
        }
        if (button.dataset.action === "remove-topic") {
            normalizeTopics(subject);
            const topic = subject.topics.find((item) => item.id === button.dataset.topicId);
            if (topic) topic.archived = true;
            delete subject.topic;
            invalidateSchedule();
            renderList();
        }
    });
    if (!dialogsInitialized) {
        setupDialogs();
        dialogsInitialized = true;
    }
    renderList();
}

registerPageSetup(pageType.QUESTIONNAIRE_SUBJECTS, setupSubjects);
registerPageSetup(pageType.SUBJECTS, setupSubjects);
