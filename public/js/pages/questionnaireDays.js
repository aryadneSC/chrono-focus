import { registerPageSetup } from "./router.js";
import { pageType } from "../util/enum.js";
import { plan, invalidateSchedule } from "../state/scheduleState.js";

import { dayNames, validateRoutine } from "../util/studyTime.js";

let validationRequested = false;

export function validateRoutineForm(focus = true) {
    validationRequested = true;
    const errors = validateRoutine(plan);
    const targets = { days: "routine-days-error", preference: "routine-preference-error", period: "routine-period-error" };
    for (const id of [...Object.values(targets), "routine-time-error"]) {
        document.getElementById(id).textContent = errors.filter((error) => (targets[error.field] || "routine-time-error") === id).map((error) => error.message).join(" ");
    }
    document.querySelectorAll('#activity input, #activity [data-day], #preference-fixed-time').forEach((input) => input.removeAttribute("aria-invalid"));
    const selector = (field) => field === "days" ? "[data-day]" : field === "preference" ? "#preference-fixed-time" : field === "period" ? 'input[name="periodos"]' : `#${field}`;
    errors.forEach((error) => document.querySelector(selector(error.field))?.setAttribute("aria-invalid", "true"));
    if (focus && errors.length) document.querySelector(selector(errors[0].field))?.focus();
    return errors.length === 0;
}

function setupDays() {
    validationRequested = false;
    const changed = () => {
        invalidateSchedule();
        if (validationRequested) validateRoutineForm(false);
    };
    const fixedButton = document.querySelector("#preference-fixed-time");
    const periodButton = document.querySelector("#preference-period");
    const fixedPanel = document.querySelector("#fixed-time-panel");
    const periodPanel = document.querySelector("#period-panel");
    const preferenceChoice = document.querySelector("#preference-choice");
    const sharedTimePanel = document.querySelector("#shared-study-time-panel");
    const dailyTimePanel = document.querySelector("#daily-study-time-panel");
    const dailyTimes = document.querySelector("#daily-study-times");
    const selectedDays = document.querySelector("#selected-study-days");
    const timeSelect = document.querySelector("#study-time");
    plan.studyTimeByDay ||= {};
    plan.studyTimeMode ||= "same";

    function showPanel(preference) {
        preferenceChoice.classList.toggle("hidden", preference !== null);
        const durationPanel = document.querySelector("#duration-panel");
        durationPanel.classList.toggle("hidden", preference === null);
        const activePanel = preference === "fixed-time" ? fixedPanel : preference === "period" ? periodPanel : null;
        if (activePanel) activePanel.insertBefore(durationPanel, activePanel.querySelector("button"));
        fixedPanel.classList.toggle("hidden", preference !== "fixed-time");
        periodPanel.classList.toggle("hidden", preference !== "period");
        fixedButton.setAttribute("aria-expanded", preference === "fixed-time");
        periodButton.setAttribute("aria-expanded", preference === "period");
    }

    function showStudyTimeMode() {
        const customByDay = plan.studyTimeMode === "by-day";
        sharedTimePanel.classList.toggle("hidden", customByDay);
        dailyTimePanel.classList.toggle("hidden", !customByDay);
        document.querySelectorAll('input[name="study-time-mode"]').forEach((radio) => {
            radio.checked = radio.value === plan.studyTimeMode;
        });
    }

    function renderDailyTimes() {
        selectedDays.textContent = plan.days.length
            ? `Dias selecionados: ${plan.days.map((day) => dayNames[day]).join(", ")}`
            : "Selecione os dias de estudo para definir o tempo de cada um.";
        dailyTimes.replaceChildren();
        plan.days.forEach((day) => {
            const row = document.createElement("div");
            row.className = "daily-study-time-row";
            const label = document.createElement("label");
            label.textContent = dayNames[day];
            label.htmlFor = `study-time-${day}`;
            const input = document.createElement("input");
            input.type = "text";
            input.id = `study-time-${day}`;
            input.className = "input-txt";
            input.inputMode = "numeric";
            input.placeholder = "00:30";
            input.pattern = "[0-9]{2}:[0-5][0-9]";
            input.value = plan.studyTimeByDay[day] || "";
            input.setAttribute("aria-describedby", "routine-time-error");
            input.setAttribute("aria-label", `Tempo de estudo em ${dayNames[day]}, horas:minutos`);
            input.addEventListener("input", () => { plan.studyTimeByDay[day] = input.value; changed(); });
            row.append(label, input);
            dailyTimes.append(row);
        });
    }

    document.querySelectorAll("[data-day]").forEach((button) => {
        button.setAttribute("aria-pressed", plan.days.includes(button.dataset.day));
        button.addEventListener("click", () => {
            const day = button.dataset.day;
            plan.days = plan.days.includes(day) ? plan.days.filter((value) => value !== day) : [...plan.days, day];
            button.setAttribute("aria-pressed", plan.days.includes(day));
            renderDailyTimes();
            changed();
        });
    });

    fixedButton.addEventListener("click", () => {
        plan.preference = "fixed-time";
        showPanel("fixed-time");
        changed();
    });
    periodButton.addEventListener("click", () => {
        plan.preference = "period";
        showPanel("period");
        changed();
    });
    document.querySelector("#preference-back-fixed-time").addEventListener("click", () => {
        plan.preference = null;
        showPanel(null);
        changed();
    });
    document.querySelector("#preference-back-period").addEventListener("click", () => {
        plan.preference = null;
        showPanel(null);
        changed();
    });

    timeSelect.value = plan.studyTime;
    timeSelect.addEventListener("input", () => { plan.studyTime = timeSelect.value; changed(); });
    document.querySelectorAll('input[name="study-time-mode"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            if (!radio.checked) return;
            plan.studyTimeMode = radio.value;
            showStudyTimeMode();
            changed();
        });
    });
    document.querySelectorAll('input[name="periodos"]').forEach((radio) => {
        radio.checked = plan.periods[0] === radio.value;
        radio.addEventListener("change", () => {
            if (radio.checked) { plan.periods = [radio.value]; changed(); }
        });
    });
    renderDailyTimes();
    showStudyTimeMode();
    showPanel(plan.preference);
}

registerPageSetup(pageType.QUESTIONNAIRE_DAYS, setupDays);
