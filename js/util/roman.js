/*
 * Números e datas em latim — a camada de "releitura" romana da interface.
 * Só apresentação: nada aqui altera dados do plano.
 */

const ROMAN_NUMERALS = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
];

export function toRoman(value) {
    const number = Math.trunc(Number(value));
    if (!Number.isFinite(number) || number <= 0 || number > 3999) return String(value ?? "");
    let rest = number;
    let text = "";
    for (const [amount, glyph] of ROMAN_NUMERALS) {
        while (rest >= amount) {
            text += glyph;
            rest -= amount;
        }
    }
    return text;
}

// Associado a Date#getDay(): domingo primeiro.
const LATIN_WEEKDAYS = [
    "Die Solis",
    "Die Lunae",
    "Die Martis",
    "Die Mercurii",
    "Die Iovis",
    "Die Veneris",
    "Die Saturni",
];

const LATIN_MONTHS = ["IAN", "FEB", "MAR", "APR", "MAI", "IVN", "IVL", "AVG", "SEP", "OCT", "NOV", "DEC"];

export function latinDateLabel(date = new Date()) {
    const day = date.getDate();
    return `${LATIN_WEEKDAYS[date.getDay()]} · ${toRoman(day)} ${LATIN_MONTHS[date.getMonth()]}`;
}

export function latinWeekday(date = new Date()) {
    return LATIN_WEEKDAYS[date.getDay()];
}

export function latinMonth(date = new Date()) {
    return LATIN_MONTHS[date.getMonth()];
}
