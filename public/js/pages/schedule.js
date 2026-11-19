import { registerPageSetup } from "./router.js";
import { pageType } from "../util/enum.js";
import { plan } from "../state/scheduleState.js";
import { regenerateSchedule } from "../state/scheduleService.js";
import { mountScheduleControls } from "../components/scheduleControls.js";
import { formatLocalDate, localDateValue } from "../util/dates.js";
import { dayNames } from "../util/studyTime.js";
import { visibleTopics, subjectCompleted } from "../util/topics.js";

function setupSchedule() {
    let visibleDays = 7;
    const controls = mountScheduleControls((values) => {
        const result = regenerateSchedule(values);
        visibleDays = 7;
        render();
        if (!result.ok) controls.status.textContent = result.error;
    });
    const list = document.querySelector("#schedule-list");
    const more = document.querySelector("#schedule-more");
    function render() {
        list.replaceChildren();
        more.hidden = !plan.scheduleGenerated || visibleDays >= plan.schedule.length;
        if (!plan.scheduleGenerated) {
            controls.status.textContent = plan.schedule.length ? "O cronograma está desatualizado. Atualize para usar as alterações." : "Configure sua rotina e matérias e atualize o cronograma.";
            return;
        }
        controls.status.textContent = ["Cronograma de 30 dias gerado.", ...plan.scheduleWarnings].join(" ");
        for (const day of plan.schedule.slice(0, visibleDays)) {
            const card = document.createElement("section");
            card.className = "card-column card-accent schedule-day";
            card.dataset.date = day.date;
            const heading = document.createElement("h3");
            heading.textContent = `${formatLocalDate(day.date)} · ${dayNames[day.dayKey]}`;
            card.append(heading);
            let count = 0;
            for (const session of day.sessions) {
                const subject = plan.subjects.find((item) => item.id === session.subjectId);
                if (subject && day.date > localDateValue() && subjectCompleted(subject, day.date)) continue;
                const title = document.createElement("p");
                title.textContent = `${session.subjectName} · ${session.duration} · Prioridade ${session.priorityLabel}${session.completed ? " · Foco concluído" : ""}`;
                card.append(title);
                const topics = subject ? visibleTopics(subject, day.date).filter((topic) => !session.topicIds || session.topicIds.includes(topic.id)) : [];
                if (topics.length) {
                    const names = document.createElement("p");
                    names.textContent = `Assuntos: ${topics.map((topic) => topic.name).join(", ")}`;
                    card.append(names);
                }
                count++;
            }
            if (!count) {
                const empty = document.createElement("p");
                empty.textContent = day.isStudyDay ? "Sem matérias pendentes." : "Dia de descanso.";
                card.append(empty);
            }
            list.append(card);
        }
    }
    more.addEventListener("click", () => { visibleDays = Math.min(30, visibleDays + 7); render(); });
    render();
}
registerPageSetup(pageType.SCHEDULE, setupSchedule);
