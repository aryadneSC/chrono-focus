import { plan } from "./scheduleState.js";
import { generateSchedule } from "../util/scheduler.js";
import { calendarDaysBetween, localDateValue, parseLocalDate } from "../util/dates.js";
import { subjectCompleted, visibleTopics } from "../util/topics.js";

function hasEntryHistory(entry) {
    return entry.studiedFocusMs > 0 || plan.sessionRecords.some((record) => record.scheduleEntryId === entry.id);
}

function hasHistory(day) {
    return day.sessions.some(hasEntryHistory);
}

function preserveHistory(day, today) {
    if (day.date < today) return day;
    const sessions = day.sessions.filter((entry) => {
        const subject = plan.subjects.find((item) => item.id === entry.subjectId);
        return hasEntryHistory(entry) || !subject?.deadline || day.date <= subject.deadline;
    });
    return sessions.length === day.sessions.length ? day : { ...day, sessions };
}

// Both entry points use this generator. Completed study records are never overwritten by a new projection.
export function regenerateSchedule(options = {}, today = new Date()) {
    try {
        const revision = plan.scheduleRevision + 1;
        const result = generateSchedule({ ...plan, ...options }, today, revision);
        const date = localDateValue(today);
        const previous = new Map(plan.schedule.map((day) => [day.date, day]));
        const days = result.days.map((day) => {
            const old = previous.get(day.date);
            return old && (day.date < date || hasHistory(old)) ? preserveHistory(old, date) : day;
        });
        Object.assign(plan, options, {
            schedule: days, scheduleStartDate: result.startDate,
            scheduleGenerated: true, scheduleRevision: revision, scheduleWarnings: result.warnings,
            currentSession: null,
        });
        return { ok: true, warnings: result.warnings };
    } catch (error) {
        plan.scheduleGenerated = false;
        plan.currentSession = null;
        return { ok: false, error: error.message };
    }
}

// Reuse the same algorithm on the remaining future window; today's allocation and all history stay intact.
export function refreshFutureSchedule(today = new Date(), redistribute = true) {
    if (!plan.scheduleGenerated || !plan.schedule.length) { return { ok: true }; }
    const date = localDateValue(today);
    const future = plan.schedule.filter((day) => day.date > date);
    if (!future.length) { return { ok: true }; }
    if (!redistribute) {
        for (const day of future) {
            if (hasHistory(day)) {
                day.sessions = preserveHistory(day, date).sessions;
                continue;
            }
            day.sessions = day.sessions.filter((entry) => {
                const subject = plan.subjects.find((item) => item.id === entry.subjectId);
                if (!subject) return true;
                entry.topicIds = visibleTopics(subject, day.date).map((topic) => topic.id);
                return !subjectCompleted(subject, day.date) && (!subject.deadline || day.date <= subject.deadline);
            });
        }
        return { ok: true };
    }
    try {
        const revision = plan.scheduleRevision + 1;
        const count = calendarDaysBetween(parseLocalDate(future[0].date), parseLocalDate(future.at(-1).date)) + 1;
        const result = generateSchedule({ ...plan, scheduleStartDate: future[0].date }, today, revision, count);
        const replacement = new Map(result.days.map((day) => [day.date, day]));
        plan.schedule = plan.schedule.map((day) => day.date > date
            ? hasHistory(day) ? preserveHistory(day, date) : replacement.get(day.date) || day
            : day);
        plan.scheduleRevision = revision;
        plan.scheduleWarnings = result.warnings;
        return { ok: true };
    } catch (error) {
        plan.scheduleWarnings = [error.message];
        return { ok: false, error: error.message };
    }
}

export function completeCurrentSession() {
    if (!plan.scheduleGenerated || !plan.currentSession) return false;
    const current = plan.currentSession;
    const day = plan.schedule.find((entry) => entry.date === current.date);
    const session = day?.sessions.find((entry) => entry.id === current.plannedSessionId);
    if (!session || session.completed || session.remainingFocusMs !== 0) return false;
    session.completed = true;
    plan.currentSession = null;
    return true;
}
