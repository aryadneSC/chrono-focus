import { localDateValue, parseLocalDate, weekdayKeys } from "./dates.js";
import { formatMinutes, parseStudyTime, validateRoutine } from "./studyTime.js";
import { calculateSchedulePriority } from "./schedulePriority.js";
import { subjectCompleted, visibleTopics } from "./topics.js";
import { validateScheduleConfig } from "./scheduleConfig.js";

function compareSubjects(a, b) {
    return b.score - a.score || (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31") || a.index - b.index;
}

// Hamilton's largest remainder method; capacity is a per-item maximum, not a weight.
export function allocateWeighted(total, items, capacity = total) {
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(capacity) || capacity < 0
        || items.some((item) => !Number.isFinite(item.score) || item.score <= 0) || total > items.length * capacity) {
        throw new Error("Não é possível distribuir as vagas com essa capacidade.");
    }
    const counts = items.map(() => 0);
    let remaining = total;
    let active = items.map((item, index) => ({ ...item, index: item.index ?? index, position: index }));
    while (remaining > 0) {
        const sum = active.reduce((value, item) => value + item.score, 0);
        const shares = active.map((item) => ({ ...item, ideal: remaining * item.score / sum }));
        const saturated = shares.filter((item) => item.ideal >= capacity);
        if (saturated.length) {
            for (const item of saturated) {
                counts[item.position] = capacity;
                remaining -= capacity;
            }
            const positions = new Set(saturated.map((item) => item.position));
            active = active.filter((item) => !positions.has(item.position));
            continue;
        }
        shares.forEach((item) => { counts[item.position] = Math.floor(item.ideal); });
        remaining -= shares.reduce((value, item) => value + Math.floor(item.ideal), 0);
        shares.sort((a, b) => (b.ideal % 1) - (a.ideal % 1) || compareSubjects(a, b));
        for (let i = 0; i < remaining; i++) counts[shares[i].position]++;
        remaining = 0;
    }
    return counts;
}

export function distributeFrequencies(items, totalSlots, studyDayCount) {
    if (totalSlots < items.length) {
        const chosen = [...items].map((item, index) => ({ ...item, index })).sort(compareSubjects).slice(0, totalSlots);
        const positions = new Set(chosen.map((item) => item.index));
        return items.map((_, index) => positions.has(index) ? 1 : 0);
    }
    return allocateWeighted(totalSlots - items.length, items, studyDayCount - 1).map((count) => count + 1);
}

export function spreadSubjects(items, frequencies, studyDayCount, slotsPerDay) {
    const assigned = items.map(() => 0);
    const totalScore = items.reduce((sum, item) => sum + item.score, 0);
    const totalSlots = frequencies.reduce((sum, count) => sum + count, 0);
    const remainders = items.map((item) => (item.score / totalScore * Math.max(0, totalSlots - items.length)) % 1);
    return Array.from({ length: studyDayCount }, (_, dayIndex) => {
        const chosen = [];
        for (let slot = 0; slot < slotsPerDay; slot++) {
            const candidates = items.map((item, index) => ({ ...item, index,
                remaining: frequencies[index] - assigned[index],
                deficit: frequencies[index] * (dayIndex + 1) / studyDayCount - assigned[index],
            })).filter((item) => item.remaining > 0 && !chosen.includes(item.index));
            // A subject due on every remaining day must be placed now to preserve the quotas.
            candidates.sort((a, b) => Number(b.remaining === studyDayCount - dayIndex) - Number(a.remaining === studyDayCount - dayIndex)
                || b.deficit - a.deficit || remainders[b.index] - remainders[a.index] || compareSubjects(a, b));
            if (!candidates.length) throw new Error("Não foi possível respeitar a frequência das matérias.");
            const index = candidates[0].index;
            chosen.push(index);
            assigned[index]++;
        }
        return chosen;
    });
}

// Pure output contract: 30 local dates, each with sessions; sessions carry subject IDs, focus durations and completion state.
export function generateSchedule(routine, today = new Date(), revision = 0, windowDays = 30) {
    const errors = validateRoutine(routine);
    if (errors.length) throw new Error(errors.map((error) => error.message).join(" "));
    const start = parseLocalDate(routine.scheduleStartDate ?? localDateValue(today));
    const configError = validateScheduleConfig({ scheduleStartDate: localDateValue(start || today), subjectsPerDay: routine.subjectsPerDay });
    if (!start || configError) throw new Error(configError || "Escolha uma data válida.");
    if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 30) throw new Error("Janela de cronograma inválida.");
    const subjects = routine.subjects;
    if (!Array.isArray(subjects) || subjects.length < 2) throw new Error("Cadastre pelo menos 2 matérias válidas.");
    const ids = new Set();
    const validItems = subjects.map((subject, index) => {
        if (!subject.id || ids.has(subject.id) || typeof subject.name !== "string" || !subject.name.trim()) {
            throw new Error("Confira os nomes e identificadores das matérias.");
        }
        ids.add(subject.id);
        return { ...subject, ...calculateSchedulePriority(subject, today), index };
    });
    const items = validItems.filter((subject) => !subjectCompleted(subject, localDateValue(today)));
    const days = Array.from({ length: windowDays }, (_, offset) => {
        const date = new Date(start);
        date.setDate(date.getDate() + offset);
        const dayKey = weekdayKeys[date.getDay()];
        const isStudyDay = routine.days.includes(dayKey);
        return { date: localDateValue(date), dayKey, isStudyDay,
            availableMinutes: isStudyDay ? parseStudyTime(routine.studyTimeMode === "by-day" ? routine.studyTimeByDay[dayKey] : routine.studyTime) : 0,
            sessions: [] };
    });
    const studyDays = days.filter((day) => day.isStudyDay);
    if (!studyDays.length || !items.length) return { days, warnings: items.length ? [] : ["Todas as matérias estão concluídas."], frequencies: items.map(() => 0), totalSlots: 0, startDate: localDateValue(start) };
    // Keep the existing distribution within each window with the same eligible subjects.
    // A deadline is inclusive; after it expires only the remaining subjects receive slots.
    const windows = [];
    for (const day of studyDays) {
        const eligible = items.filter((subject) => !subject.deadline || day.date <= subject.deadline);
        const previous = windows.at(-1);
        if (previous && previous.items.length === eligible.length && previous.items.every((subject, index) => subject.id === eligible[index].id)) {
            previous.days.push(day);
        } else windows.push({ items: eligible, days: [day] });
    }
    const frequencies = items.map(() => 0);
    let totalSlots = 0;
    for (const window of windows) {
        if (!window.items.length) continue;
        const slotsPerDay = Math.min(routine.subjectsPerDay, window.items.length);
        const slots = window.days.length * slotsPerDay;
        const counts = distributeFrequencies(window.items, slots, window.days.length);
        const assignments = spreadSubjects(window.items, counts, window.days.length, slotsPerDay);
        counts.forEach((count, index) => { frequencies[items.indexOf(window.items[index])] += count; });
        totalSlots += slots;
        window.days.forEach((day, index) => {
            const selected = assignments[index].map((position) => window.items[position]);
            const minutes = allocateWeighted(day.availableMinutes, selected);
            day.sessions = selected.map((subject, position) => {
                const durationMinutes = minutes[position];
                if (durationMinutes <= 0) throw new Error(`${subject.name} não recebeu tempo de foco. Diminua as matérias por dia ou aumente o tempo disponível.`);
                return {
                    id: `${revision}:${day.date}:${subject.id}`, date: day.date,
                    subjectId: subject.id, subjectName: subject.name,
                    priorityScore: subject.score, priorityLabel: subject.label,
                    durationMinutes, duration: formatMinutes(durationMinutes), completed: false,
                    topicIds: visibleTopics(subject, day.date).map((topic) => topic.id),

                };
            });
        });
    }
    const warnings = [];
    const slotsPerDay = Math.min(routine.subjectsPerDay, items.length);
    if (slotsPerDay < routine.subjectsPerDay) warnings.push(`Há ${items.length} matérias disponíveis. A distribuição foi limitada a ${slotsPerDay} matérias distintas por dia.`);
    const uncovered = items.filter((_, index) => frequencies[index] === 0);
    if (uncovered.length) warnings.push(`Sem ocorrência nesta janela por falta de vagas: ${uncovered.map((subject) => subject.name).join(", ")}.`);
    return { days, warnings, frequencies, totalSlots, startDate: localDateValue(start) };
}
