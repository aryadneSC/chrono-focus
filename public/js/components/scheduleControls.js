import { plan, invalidateSchedule } from "../state/scheduleState.js";
import { localDateValue } from "../util/dates.js";
import { validateScheduleConfig } from "../util/scheduleConfig.js";

export function mountScheduleControls(onGenerate = null) {
    const host = document.querySelector("[data-schedule-controls]");
    host.replaceChildren(document.querySelector("#schedule-controls-template").content.cloneNode(true));
    const dateInput = host.querySelector("#schedule-start-date");
    const subjectsInput = host.querySelector("#subjects-per-day");
    const status = host.querySelector("#schedule-status");
    if (plan.scheduleStartDate === null) plan.scheduleStartDate = localDateValue();
    dateInput.value = plan.scheduleStartDate;
    subjectsInput.value = String(plan.subjectsPerDay);
    const values = () => ({ scheduleStartDate: dateInput.value, subjectsPerDay: Number(subjectsInput.value) });
    const validate = () => {
        const error = validateScheduleConfig(values());
        status.textContent = error;
        if (error) (!dateInput.value || !dateInput.validity.valid ? dateInput : subjectsInput).focus();
        return !error;
    };
    const update = () => {
        Object.assign(plan, values());
        invalidateSchedule();
        status.textContent = validateScheduleConfig(values()) || "Configurações alteradas. O cronograma será gerado ao confirmar.";
    };
    dateInput.addEventListener("input", update);
    subjectsInput.addEventListener("input", update);
    if (onGenerate) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "schedule-save";
        button.className = "btn btn-primary";
        button.textContent = "Atualizar cronograma";
        button.addEventListener("click", () => { if (validate()) onGenerate(values()); });
        host.querySelector("section").insertBefore(button, status);
    }
    return { values, validate, status };
}
