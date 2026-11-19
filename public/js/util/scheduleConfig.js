import { parseLocalDate } from "./dates.js";

export function validateScheduleConfig({ scheduleStartDate, subjectsPerDay }) {
    if (!parseLocalDate(scheduleStartDate)) return "Escolha uma data inicial válida.";
    if (!Number.isSafeInteger(subjectsPerDay) || subjectsPerDay < 1) return "Informe um número inteiro de matérias por dia, a partir de 1.";
    return "";
}
