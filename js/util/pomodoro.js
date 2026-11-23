export function timeToMinutes(value) {
    if (typeof value !== "string" || !/^\d{2}:[0-5]\d$/.test(value)) return NaN;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
}

export function validatePomodoroSettings({ focus, pause, cycles }) {
    const focusMinutes = timeToMinutes(focus);
    const pauseMinutes = timeToMinutes(pause);
    const cycleCount = Number(cycles);

    if (!Number.isFinite(focusMinutes) || focusMinutes < 1 || focusMinutes > 480) {
        return "O tempo de foco deve ficar entre 1 minuto e 8 horas.";
    }
    if (!Number.isFinite(pauseMinutes) || pauseMinutes < 0 || pauseMinutes > 60) {
        return "O tempo de pausa deve ser de até 1 hora.";
    }
    if (!Number.isInteger(cycleCount) || cycleCount < 1) {
        return "Informe pelo menos 1 ciclo.";
    }
    return "";
}
