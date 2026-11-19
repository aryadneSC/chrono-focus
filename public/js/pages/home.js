import { registerPageSetup } from "./router.js";
import { pageType } from "../util/enum.js";
import { plan } from "../state/scheduleState.js";
import { remainingAllocationMs } from "../state/studyRecords.js";
import { startStudySession } from "./studySession.js";
import { formatTimerDuration } from "../util/studyTimer.js";
import { formatLocalDate, localDateValue } from "../util/dates.js";
import { getTopics, visibleTopics, topicDayStatus } from "../util/topics.js";

const selectedTopics = new Map();
let midnightRefresh = null;

function renderHome() {
    const today = localDateValue();
    const date = document.querySelector("#home-date");
    date.textContent = formatLocalDate(today);
    date.dataset.date = today;
    const count = document.querySelector("#home-pending-count");
    const list = document.querySelector("#home-subject-list");
    list.replaceChildren();
    const day = plan.scheduleGenerated ? plan.schedule.find((entry) => entry.date === today) : null;
    const cards = (day?.sessions || []).map((session) => {
        const subject = plan.subjects.find((item) => item.id === session.subjectId) || { id: session.subjectId, topics: [] };
        const topics = visibleTopics(subject, today);
        const completedToday = topics.some((topic) => topicDayStatus(topic, today).date === today);
        const allTopicsDone = getTopics(subject).every((topic) => topicDayStatus(topic, today).completed);
        const exhausted = remainingAllocationMs(session) === 0;
        const done = allTopicsDone || exhausted;
        const available = !done && !session.completed && topics.some((topic) => !topicDayStatus(topic, today).completed);
        return { session, subject, topics, completedToday, allTopicsDone, exhausted, done, available };
    }).filter((card) => card.available || card.completedToday || (card.exhausted && card.topics.length > 0));
    const pendingCount = cards.filter((card) => card.available).length;
    count.textContent = !plan.scheduleGenerated
        ? (plan.schedule.length ? "Cronograma desatualizado. Atualize na aba Cronograma." : "Gere um cronograma para consultar as sessões de hoje.")
        : !day ? "Hoje está fora da janela do cronograma."
            : !day.isStudyDay ? "Hoje é dia de descanso."
                : !pendingCount ? "Nenhuma sessão pendente para hoje."
                    : pendingCount === 1 ? "Você tem 1 matéria para estudar hoje." : `Você tem ${pendingCount} matérias para estudar hoje.`;
    for (const { session, subject, topics, allTopicsDone, exhausted, done, available } of cards) {
        const card = document.createElement("article");
        card.className = "card-column card-accent home-session";
        card.classList.toggle("subject-completed", done);
        card.dataset.sessionId = session.id;
        const heading = document.createElement("h3");
        heading.textContent = session.subjectName;
        const duration = document.createElement("p");
        duration.textContent = `Tempo planejado: ${session.duration}`;
        const error = document.createElement("p");
        error.className = "text-danger";
        error.id = `topic-error-${session.id}`;
        error.setAttribute("role", "alert");
        const group = document.createElement("fieldset");
        group.className = "study-time-mode";
        const legend = document.createElement("legend");
        legend.textContent = allTopicsDone ? "Todos os assuntos concluídos" : exhausted ? "Assuntos da sessão" : "Escolha o assunto";
        group.append(legend);
        let selected = selectedTopics.get(session.id) || null;
        if (exhausted || !topics.some((topic) => topic.id === selected && !topicDayStatus(topic, today).completed)) selected = null;
        topics.forEach((topic) => {
            const status = topicDayStatus(topic, today);
            const label = document.createElement("label");
            label.classList.toggle("topic-completed", status.completed);
            label.classList.toggle("topic-incomplete", exhausted && !status.completed);
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = `subject-topic-${session.id}`;
            radio.value = topic.id;
            radio.required = true;
            radio.checked = selected === topic.id;
            radio.disabled = status.completed || exhausted;
            radio.setAttribute("aria-describedby", error.id);
            radio.addEventListener("change", () => {
                selected = topic.id;
                selectedTopics.set(session.id, topic.id);
                error.textContent = "";
                group.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));
            });
            label.append(radio, document.createTextNode(`${topic.name}${status.completed ? " · Concluído" : exhausted ? " · Não concluído" : ""}`));
            group.append(label);
        });
        const start = document.createElement("button");
        start.type = "button";
        start.className = "btn btn-primary";
        start.textContent = done ? "Sessão concluída" : "Iniciar sessão";
        start.disabled = !available;
        start.addEventListener("click", () => {
            if (localDateValue() !== today || !plan.scheduleGenerated) { renderHome(); return; }
            const topic = getTopics(subject).find((item) => item.id === selected && !topicDayStatus(item).completed);
            if (!topic) {
                error.textContent = "Escolha um assunto pendente para iniciar a sessão.";
                group.querySelectorAll("input:not(:disabled)").forEach((input) => input.setAttribute("aria-invalid", "true"));
                group.querySelector("input:not(:disabled)")?.focus();
                return;
            }
            try {
                startStudySession({ subjectId: session.subjectId, subjectName: session.subjectName, topicId: topic.id, topicName: topic.name,
                    allocatedMinutes: remainingAllocationMs(session) / 60000, scheduleEntryId: session.id });
            } catch (failure) { error.textContent = failure.message; }
        });
        card.append(heading, duration);
        if (session.studiedFocusMs > 0 || exhausted) {
            const remaining = document.createElement("p");
            const formatted = formatTimerDuration(remainingAllocationMs(session));
            remaining.textContent = `Tempo restante: ${formatted.length === 5 ? `00:${formatted}` : formatted}`;
            card.append(remaining);
        }
        const latest = [...plan.sessionRecords].reverse().find((record) => record.subjectId === session.subjectId);
        if (latest?.resumeNote) {
            const note = document.createElement("p");
            note.className = "resume-note";
            note.textContent = `Nota de retomada${latest.topicName ? ` (${latest.topicName})` : ""}: ${latest.resumeNote}`;
            card.append(note);
        }
        card.append(group, error, start);
        list.append(card);
    }
    clearTimeout(midnightRefresh);
    const midnight = new Date();
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    midnightRefresh = setTimeout(refreshDate, midnight.getTime() - Date.now() + 50);
}

function refreshDate() {
    const date = document.querySelector("#home-date");
    if (date && date.dataset.date !== localDateValue()) renderHome();
}
window.addEventListener("focus", refreshDate);
document.addEventListener("visibilitychange", refreshDate);
registerPageSetup(pageType.HOME, renderHome);
