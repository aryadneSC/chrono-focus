import { plan } from "./scheduleState.js";
import { createStudyTimer } from "../util/studyTimer.js";
import { getTopics, topicDayStatus } from "../util/topics.js";
import { applyStudyRecord, findStudyAllocation, remainingAllocationMs } from "./studyRecords.js";

const timer = createStudyTimer({ now: () => Date.now(), getConfig: () => plan.pomodoro });
const listeners = new Set();
let wakeup = null;
let generation = 0;
let savedRecord = null;
let metadata = { isTest: false, date: null };
let draft = { performance: "", resumeNote: "", topicCompleted: false, topicCompletedToday: false };
let confirmation = false;
let automaticDailyMarked = false;

export function getStudyTimerState() {
    const state = timer.snapshot();
    if (state?.endReason === "completed" && !automaticDailyMarked) {
        draft.topicCompletedToday = true;
        automaticDailyMarked = true;
    }
    return state ? { ...state, ...metadata, confirming: confirmation || state.phase === "ended", canReturn: confirmation && state.phase !== "ended", saved: Boolean(savedRecord), draft: { ...draft } } : null;
}

function stopClock() {
    if (wakeup !== null) clearTimeout(wakeup);
    wakeup = null;
    generation++;
}

function notify() {
    const state = getStudyTimerState();
    listeners.forEach((listener) => listener(state));
}

function scheduleTick() {
    const state = timer.snapshot();
    if (wakeup !== null || !state || state.phase === "ended" || state.suspended || state.paused) return;
    const token = generation;
    wakeup = setTimeout(() => {
        if (token !== generation) return;
        wakeup = null;
        timer.tick();
        notify();
        scheduleTick();
    }, 200);
}

function act(action) {
    stopClock();
    try { action(); }
    finally { notify(); scheduleTick(); }
    return getStudyTimerState();
}

export function subscribeStudyTimer(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function refreshStudyTimer() {
    return act(() => timer.tick());
}

export function startStudySession({ subjectId, subjectName, allocatedMinutes, scheduleEntryId = null, isTest = false, topicId = null, topicName = null }) {
    const active = timer.tick();
    if (active && active.phase !== "ended") {
        if (active.subjectId === subjectId && active.scheduleEntryId === scheduleEntryId) return refreshStudyTimer();
        throw new Error("Encerre a sessão em andamento antes de iniciar outra matéria.");
    }
    if (active && !savedRecord) throw new Error("Finalize a sessão encerrada antes de iniciar outra matéria.");
    const allocation = findStudyAllocation(scheduleEntryId, subjectId);
    if (scheduleEntryId && !allocation) throw new Error("A alocação dessa matéria não está disponível no cronograma atual.");
    const requestedMs = Math.round(allocatedMinutes * 60000);
    if (!Number.isSafeInteger(requestedMs) || requestedMs <= 0) throw new Error("Informe um tempo de foco positivo para a matéria.");
    const limit = allocation ? Math.min(requestedMs, remainingAllocationMs(allocation.entry)) : requestedMs;
    if (limit <= 0 || allocation?.entry.completed) throw new Error("Essa matéria não tem tempo pendente nessa alocação.");
    const subject = plan.subjects.find((item) => item.id === subjectId);
    const topics = subject ? getTopics(subject) : [{ id: topicId || `${subjectId}:free`, name: topicName || "Estudo livre", events: [] }];
    const topic = topics.find((item) => item.id === topicId) || (!topicId && topics.length === 1 ? topics[0] : null);
    if (!topic || topicDayStatus(topic).completed) throw new Error("Escolha um assunto pendente para iniciar a sessão.");
    return act(() => {
        timer.start({ subjectId, subjectName, allocatedMinutes: limit / 60000, scheduleEntryId, sessionId: crypto.randomUUID() });
        metadata = { isTest, date: allocation?.date || null, topicId: topic.id, topicName: topic.name };
        confirmation = false;
        automaticDailyMarked = false;
        savedRecord = null;
        draft = { performance: "", resumeNote: "", topicCompleted: false, topicCompletedToday: false };
        plan.currentSession = { subjectId, subjectName, allocatedMinutes: limit / 60000,
            plannedSessionId: scheduleEntryId, date: metadata.date, topicId: topic.id, topicName: topic.name };
    });
}

// Compatibility at the session boundary: ignore topic duration and read the whole subject allocation.
// Today calls startStudySession directly; this boundary remains for older callers.
export function ensureStudySession() {
    const state = timer.snapshot();
    const requested = plan.currentSession;
    if (state && state.phase !== "ended" && requested?.subjectId
        && (requested.subjectId !== state.subjectId || (requested.plannedSessionId && requested.plannedSessionId !== state.scheduleEntryId))) {
        throw new Error("Encerre a sessão em andamento antes de iniciar outra matéria.");
    }
    if (state && (state.phase !== "ended" || !savedRecord)) return refreshStudyTimer();
    const input = plan.currentSession;
    if (!input) return getStudyTimerState();
    const allocation = findStudyAllocation(input.plannedSessionId, input.subjectId);
    if (allocation) return startStudySession({ subjectId: allocation.entry.subjectId, subjectName: allocation.entry.subjectName,
        allocatedMinutes: remainingAllocationMs(allocation.entry) / 60000, scheduleEntryId: allocation.entry.id, topicId: input.topicId, topicName: input.topicName });
    if (input.allocatedMinutes) return startStudySession(input);
    throw new Error("O timer precisa receber o tempo destinado à matéria pelo cronograma.");
}

export function pauseStudySession() { return act(() => timer.pause()); }
export function resumeStudySession() { return act(() => timer.resume()); }
export function endStudySession() {
    return act(() => {
        timer.suspend();
        if (timer.snapshot()) confirmation = true;
    });
}

export function returnFromSessionEnd() {
    const state = getStudyTimerState();
    if (!state?.canReturn || savedRecord) return state;
    return act(() => {
        confirmation = false;
        timer.restore(true);
    });
}
export function suspendForPomodoroSettings() { return act(() => timer.suspend()); }
export function restoreFromPomodoroSettings() { return act(() => timer.restore()); }

export function updateStudySessionDraft(values) {
    if (savedRecord) return;
    draft = {
        performance: ["low", "medium", "good"].includes(values.performance) ? values.performance : "",
        resumeNote: String(values.resumeNote || "").slice(0, 200),
        topicCompleted: Boolean(values.topicCompleted),
        topicCompletedToday: values.topicCompletedToday === undefined ? draft.topicCompletedToday : Boolean(values.topicCompletedToday),
    };
}

export function saveStudySession() {
    if (savedRecord) return savedRecord;
    if (!getStudyTimerState()?.confirming) throw new Error("Encerre a sessão antes de salvar o registro.");
    stopClock();
    const state = timer.end();
    confirmation = false;
    const record = {
        id: state.sessionId, subjectId: state.subjectId, subjectName: state.subjectName,
        scheduleEntryId: state.scheduleEntryId, date: metadata.date, topicId: metadata.topicId, topicName: metadata.topicName,
        allocatedMinutes: state.allocatedMs / 60000, studiedMinutes: state.studiedMs / 60000, remainingMinutes: state.remainingMs / 60000,
        allocatedMilliseconds: state.allocatedMs, studiedMilliseconds: state.studiedMs, remainingMilliseconds: state.remainingMs,
        completed: state.remainingMs === 0, endedEarly: state.remainingMs > 0,
        startedAt: state.startedAt, endedAt: state.endedAt, ...draft,
    };
    savedRecord = metadata.isTest ? { ...record, isTest: true, scheduleUpdated: false } : applyStudyRecord(record);
    plan.currentSession = null;
    return savedRecord;
}

