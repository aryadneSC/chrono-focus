export const dayNames = {
    seg: "Segunda-feira", ter: "Terça-feira", qua: "Quarta-feira", qui: "Quinta-feira",
    sex: "Sexta-feira", sab: "Sábado", dom: "Domingo",
};

export function parseStudyTime(value) {
    if (typeof value !== "string" || !/^\d{2}:[0-5]\d$/.test(value)) return null;
    const [hours, minutes] = value.split(":").map(Number);
    const total = hours * 60 + minutes;
    return total >= 30 && total <= 960 ? total : null;
}

export function formatMinutes(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function validateRoutine(routine) {
    const errors = [];
    const days = Array.isArray(routine.days) ? routine.days.filter((day) => dayNames[day]) : [];
    if (!days.length) errors.push({ field: "days", message: "Selecione 1 ou mais dias." });
    if (!["fixed-time", "period"].includes(routine.preference)) {
        errors.push({ field: "preference", message: "Defina uma preferência de tempo." });
        return errors;
    }
    if (routine.preference === "period" && !["morning", "afternoon", "night"].includes(routine.periods?.[0])) {
        errors.push({ field: "period", message: "Escolha Manhã, Tarde ou Noite." });
    }
    if (routine.studyTimeMode === "by-day") {
        days.forEach((day) => {
            if (parseStudyTime(routine.studyTimeByDay?.[day]) === null) {
                errors.push({ field: `study-time-${day}`, message: `${dayNames[day]}: informe um tempo entre 00:30 e 16:00 no formato HH:MM.` });
            }
        });
    } else if (routine.studyTimeMode !== "same" || parseStudyTime(routine.studyTime) === null) {
        errors.push({ field: "study-time", message: "Informe um tempo entre 00:30 e 16:00 no formato HH:MM." });
    }
    return errors;
}
