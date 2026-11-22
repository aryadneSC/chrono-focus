import { registerPageSetup } from "./router.js";
import { pageType } from "../util/enum.js";
import { plan } from "../state/scheduleState.js";
import { getTopics, topicStatus } from "../util/topics.js";
import { formatLocalDate } from "../util/dates.js";
import { notifyAutomation } from "../util/automationWebhook.js";

const dayNames = { seg: "Segunda-feira", ter: "Terça-feira", qua: "Quarta-feira", qui: "Quinta-feira", sex: "Sexta-feira", sab: "Sábado", dom: "Domingo" };
const periodNames = { morning: "Manhã", afternoon: "Tarde", night: "Noite" };
const levelNames = { low: "Baixa", medium: "Média", high: "Alta" };

function element(tag, text, className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}

function setupReview() {
    const days = plan.days.map((day) => dayNames[day]).filter(Boolean);
    document.querySelector("#review-days").textContent = days.length ? days.join(", ") : "Nenhum dia selecionado";
    const time = plan.studyTimeMode === "by-day"
        ? plan.days.map((day) => `${dayNames[day]}: ${plan.studyTimeByDay[day] || "Não informado"}`).join(", ")
        : `${plan.studyTime || "Não informado"} por dia`;
    const period = plan.preference === "period" ? `${periodNames[plan.periods[0]] || "Período não selecionado"} · ` : "";
    document.querySelector("#review-preference").textContent = `${period}${time}`;

    const saveButton = document.querySelector("#review-save");
    if (saveButton) {
        saveButton.textContent = plan.scheduleSettingsVisited ? "Salvar" : "Configurar cronograma";
        saveButton.onclick = () => {
            if (!plan.scheduleSettingsVisited) return;
            notifyAutomation("plan_saved", {
                days: plan.days,
                studyTimeMode: plan.studyTimeMode,
                studyTime: plan.studyTime,
                studyTimeByDay: plan.studyTimeByDay,
                scheduleStartDate: plan.scheduleStartDate,
                subjectsPerDay: plan.subjectsPerDay,
                subjectsCount: plan.subjects.length,
                subjects: plan.subjects.map((s) => ({
                    id: s.id,
                    name: s.name,
                    importance: s.importance || s.priority,
                    difficulty: s.difficulty,
                    deadline: s.deadline || "",
                })),
            });
        };
    }

    document.querySelector("#review-schedule").textContent = plan.scheduleGenerated
        ? "Cronograma atualizado. Você pode consultar os 30 dias na aba Cronograma."
        : plan.scheduleSettingsVisited
            ? `Ao salvar: 30 dias a partir de ${formatLocalDate(plan.scheduleStartDate)}, com até ${plan.subjectsPerDay} matérias por dia, considerando os assuntos pendentes.`
            : "Defina as configurações do cronograma antes de salvar a revisão.";

    const subjectsContainer = document.querySelector("#review-subjects");
    subjectsContainer.replaceChildren();
    plan.subjects.forEach((subject, index) => {
        const card = element("article", "", "card-column card-accent review-subject");
        const heading = element("h3", `${index + 1}. ${subject.name}`);
        const actions = element("div", "", "review-actions");
        for (const [action, label] of [["remove-subject", "Excluir"], ["edit-subject", "Editar"]]) {
            const button = element("button", label, "btn btn-terciary");
            button.type = "button";
            button.dataset.action = action;
            button.dataset.subjectId = subject.id;
            button.setAttribute("aria-label", `${label} ${subject.name}`);
            actions.append(button);
        }
        card.append(actions, heading);
        const topics = getTopics(subject);
        if (topics.length) {
            const topicList = element("ol", "", "subject-topics");
            topics.forEach((topic) => topicList.append(element("li", `${topic.name}${topicStatus(topic).completed ? " · Concluído" : ""}`)));
            card.append(topicList);
        }
        const importance = subject.importance || subject.priority;
        card.append(element("p", `Importância: ${levelNames[importance] || "Não informada"} · Dificuldade: ${levelNames[subject.difficulty] || "Não informada"}`));
        if (subject.deadline) {
            const [year, month, day] = subject.deadline.split("-");
            card.append(element("p", `Prazo: ${day}/${month}/${year}`));
        }
        subjectsContainer.append(card);
    });
}

registerPageSetup(pageType.REVIEW_PLAN, setupReview);