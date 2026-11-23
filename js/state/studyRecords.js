import { plan } from "./scheduleState.js";
import { changeTopicStatus, subjectCompleted, completeTopicForDay } from "../util/topics.js";
import { localDateValue } from "../util/dates.js";
import { refreshFutureSchedule } from "./scheduleService.js";

export function findStudyAllocation(scheduleEntryId, subjectId) {
    if (!plan.scheduleGenerated || !scheduleEntryId) return null;
    for (const day of plan.schedule) {
        const entry = day.sessions.find((session) => session.id === scheduleEntryId && session.subjectId === subjectId);
        if (entry) return { entry, date: day.date };
    }
    return null;
}

export function remainingAllocationMs(entry) {
    return Math.max(0, entry.remainingFocusMs ?? Math.round(entry.durationMinutes * 60000) - (entry.studiedFocusMs || 0));
}

// Focus progress belongs to the allocation. Topic completion belongs to its stable topic ID.
export function applyStudyRecord(record) {
    const previous = plan.sessionRecords.find((item) => item.id === record.id);
    if (previous) return previous;
    const allocation = findStudyAllocation(record.scheduleEntryId, record.subjectId);
    let scheduleUpdated = false;
    if (allocation) {
        const { entry } = allocation;
        const remaining = remainingAllocationMs(entry);
        const studied = Math.min(remaining, Math.max(0, record.studiedMilliseconds));
        entry.studiedFocusMs = (entry.studiedFocusMs || 0) + studied;
        entry.remainingFocusMs = Math.max(0, remaining - studied);
        entry.completed = entry.remainingFocusMs === 0;
        scheduleUpdated = true;
    }
    const saved = { ...record, scheduleUpdated, savedOn: localDateValue() };
    plan.sessionRecords.push(saved);
    const subject = plan.subjects.find((item) => item.id === record.subjectId);
    if (record.topicCompletedToday && subject && record.topicId) {
        completeTopicForDay(subject, record.topicId, saved.savedOn, record.id);
    }
    if (record.topicCompleted && subject && record.topicId) {
        const wasComplete = subjectCompleted(subject);
        if (changeTopicStatus(subject, record.topicId, true, saved.savedOn, record.id)) {
            refreshFutureSchedule(new Date(), wasComplete !== subjectCompleted(subject));
        }
    }
    return saved;
}
