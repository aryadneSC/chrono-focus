export const weekdayKeys = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function localDateValue(date = new Date()) {
    return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return localDateValue(date) === value ? date : null;
}

export function calendarDaysBetween(start, end) {
    // UTC is used only for arithmetic on local civil date components, never to read a user's day.
    const serial = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
    return Math.round(serial(end) - serial(start));
}

export function formatLocalDate(value) {
    return parseLocalDate(value)?.toLocaleDateString("pt-BR") || value;
}
