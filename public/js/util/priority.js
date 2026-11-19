export const priorityNames = { high: "Alta", medium: "Média", low: "Baixa" };
export const difficultyNames = { high: "Alta", medium: "Média", low: "Baixa" };

const importanceWeights = { high: 2, medium: 1.5, low: 1 };
const difficultyWeights = { high: 1, medium: 0.5, low: 0 };
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function daysUntil(deadline, today) {
    if (!deadline) return null;
    const [year, month, day] = deadline.split("-").map(Number);
    const date = Date.UTC(year, month - 1, day);
    const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((date - currentDay) / millisecondsPerDay);
}

export function calculatePriority(subject, today = new Date()) {
    const importance = importanceWeights[subject.importance || subject.priority] || importanceWeights.low;
    const difficulty = difficultyWeights[subject.difficulty] ?? difficultyWeights.low;
    const timeLeft = daysUntil(subject.deadline, today);
    const deadlineWeight = timeLeft === null ? 0 : Math.max(0, (4.5 - timeLeft) * 0.8);
    const weight = importance + difficulty + deadlineWeight;
    const level = weight >= 2 ? "high" : weight >= 1.5 ? "medium" : "low";

    return { level, weight: Number(weight.toFixed(1)), timeLeft };
}

export function formatPriorityWeight(weight) {
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(weight);
}
