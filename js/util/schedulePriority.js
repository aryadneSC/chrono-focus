import { calendarDaysBetween, parseLocalDate } from "./dates.js";

const factors = { low: 0, medium: 0.5, high: 1 };
export const schedulePriorityNames = ["Muito baixa", "Baixa", "Média", "Alta", "Muito alta"];

// This is the schedule's matrix rule. The older calculatePriority API is retained for compatibility only.
export function calculateSchedulePriority(subject, today = new Date()) {
    const importance = factors[subject.importance || subject.priority];
    const difficulty = factors[subject.difficulty];
    if (importance === undefined || difficulty === undefined) throw new Error(`Classifique a importância e a dificuldade de ${subject.name}.`);
    const deadline = subject.deadline ? parseLocalDate(subject.deadline) : null;
    if (subject.deadline && !deadline) throw new Error(`Confira o prazo de ${subject.name}.`);
    const timeLeft = deadline ? calendarDaysBetween(today, deadline) : null;
    const urgent = timeLeft !== null && timeLeft <= 7;
    const score = timeLeft !== null && timeLeft < 0 ? 5
        : urgent ? 3 + importance + importance * difficulty : 1 + 2 * importance + difficulty;
    const level = Math.round(score);
    return { score, level, label: schedulePriorityNames[level - 1], timeLeft };
}
