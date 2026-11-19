import { localDateValue } from "./dates.js";

// Legacy strings become stable objects once normalized and persisted; duplicate names remain distinct.
export function getTopics(subject, includeArchived = false) {
    const raw = Array.isArray(subject.topics) ? subject.topics : subject.topic ? [subject.topic] : [];
    const topics = raw.map((value, index) => {
        const item = typeof value === "string" ? { name: value } : value;
        if (!item || typeof item.name !== "string") return null;
        const id = item.id || `${subject.id}:topic:${index}`;
        const events = Array.isArray(item.events) ? item.events : item.completedOn || item.completed || item.completedAt
            ? [{ id: `${id}:migration`, action: "completed", date: item.completedOn || (item.completedAt ? localDateValue(new Date(item.completedAt)) : localDateValue()) }] : [];
        return { ...item, id, events };
    }).filter(Boolean);
    if (includeArchived) return topics;
    const active = topics.filter((topic) => !topic.archived);
    return active.length ? active : [{ id: `${subject.id}:free:${topics.length}`, name: "Estudo livre", events: [], synthetic: true }];
}

export function normalizeTopics(subject) {
    subject.topics = getTopics(subject, true);
    delete subject.topic;
    return subject.topics;
}

export function topicStatus(topic, date = localDateValue()) {
    const events = (topic.events || []).map((event, index) => ({ ...event, index }))
        .filter((event) => event.date <= date)
        .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
    const latest = events.at(-1);
    return { completed: latest?.action === "completed", date: latest?.action === "completed" ? latest.date : null };
}

// Daily completion never participates in permanent status or future distribution.
export function topicDayStatus(topic, date = localDateValue()) {
    const permanent = topicStatus(topic, date);
    const daily = (topic.dailyCompletions || []).some((entry) => entry.date === date);
    return { completed: permanent.completed || daily, date: permanent.date || (daily ? date : null) };
}

export function subjectCompleted(subject, date = localDateValue()) {
    return getTopics(subject).every((topic) => topicStatus(topic, date).completed);
}

export function visibleTopics(subject, date = localDateValue()) {
    return getTopics(subject).filter((topic) => {
        const status = topicStatus(topic, date);
        return !status.completed || status.date === date;
    });
}

function mutableTopic(subject, topicId) {
    normalizeTopics(subject);
    let topic = subject.topics.find((item) => item.id === topicId && !item.archived);
    if (!topic) {
        topic = getTopics(subject).find((item) => item.id === topicId);
        if (!topic) return null;
        subject.topics.push(topic);
    }
    return topic;
}

export function completeTopicForDay(subject, topicId, date = localDateValue(), eventId = crypto.randomUUID()) {
    const topic = mutableTopic(subject, topicId);
    if (!topic || topicStatus(topic, date).completed) return false;
    topic.dailyCompletions ||= [];
    if (topic.dailyCompletions.some((entry) => entry.date === date || entry.id === eventId)) return false;
    topic.dailyCompletions.push({ id: eventId, date });
    return true;
}

export function changeTopicStatus(subject, topicId, completed, date = localDateValue(), eventId = crypto.randomUUID()) {
    const topic = mutableTopic(subject, topicId);
    if (!topic) return false;
    if (topic.events.some((event) => event.id === eventId)) return false;
    if (topicStatus(topic, date).completed === completed) return false;
    topic.events.push({ id: eventId, action: completed ? "completed" : "reopened", date });
    return true;
}
