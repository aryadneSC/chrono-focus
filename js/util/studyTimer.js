import { timeToMinutes, validatePomodoroSettings } from "./pomodoro.js";

export function formatTimerDuration(milliseconds, roundUp = true) {
    const seconds = Math.max(0, (roundUp ? Math.ceil : Math.floor)(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) % 60;
    const rest = String(seconds % 60).padStart(2, "0");
    return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${rest}`
        : `${String(minutes).padStart(2, "0")}:${rest}`;
}

// Clock-driven state machine. No DOM, intervals, persistence or topic allocation.
export function createStudyTimer({ now = Date.now, getConfig }) {
    let state = null;
    let serial = 0;

    function config() {
        const value = getConfig();
        const error = validatePomodoroSettings(value);
        if (error) throw new Error(error);
        return { focusMs: timeToMinutes(value.focus) * 60000, pauseMs: timeToMinutes(value.pause) * 60000, cycles: Number(value.cycles) };
    }

    function finish(at, reason) {
        state.phase = "ended";
        state.endReason = reason;
        state.endedAt = at;
        state.phaseRemainingMs = 0;
        state.deadline = null;
        state.suspended = false;
        state.paused = false;
    }

    function beginFocus(at, resume = false) {
        if (!resume) {
            const settings = config();
            state.focusBlockRemainingMs = Math.min(settings.focusMs, state.allocatedMs - state.studiedMs);
            state.cycle = state.cycle >= settings.cycles ? 1 : state.cycle + 1;
            state.cycleLimit = Math.min(settings.cycles, state.cycle - 1 + Math.ceil((state.allocatedMs - state.studiedMs) / settings.focusMs));
            state.block++;
        }
        state.phase = "focus";
        state.phaseRemainingMs = state.focusBlockRemainingMs;
        // Duração de referência do bloco: é o que enche a ampulheta no início.
        state.phaseDurationMs = state.phaseRemainingMs;
        state.lastUpdatedAt = at;
        state.deadline = at + state.phaseRemainingMs;
    }

    function beginBreak(at) {
        const duration = config().pauseMs;
        if (!duration) { beginFocus(at, state.focusBlockRemainingMs > 0); return; }
        state.phase = "break";
        state.phaseRemainingMs = duration;
        state.phaseDurationMs = duration;
        state.lastUpdatedAt = at;
        state.deadline = at + duration;
    }

    function snapshot() {
        if (!state) return null;
        const remainingMs = Math.max(0, state.allocatedMs - state.studiedMs);
        const settings = config();
        let nextPeriod = { type: "complete", durationMs: 0 };
        if (state.phase === "focus" && remainingMs > state.focusBlockRemainingMs) {
            nextPeriod = settings.pauseMs ? { type: "break", durationMs: settings.pauseMs }
                : { type: "focus", durationMs: Math.min(settings.focusMs, remainingMs - state.focusBlockRemainingMs) };
        } else if (state.phase === "break" && remainingMs > 0) {
            nextPeriod = { type: "focus", durationMs: state.focusBlockRemainingMs || Math.min(settings.focusMs, remainingMs) };
        }
        return { ...state, remainingMs, nextPeriod };
    }

    function tick(at = now()) {
        if (!state || state.phase === "ended" || state.suspended || state.paused) return snapshot();
        while (state.phase !== "ended") {
            const until = Math.max(state.lastUpdatedAt, Math.min(at, state.deadline));
            const elapsed = until - state.lastUpdatedAt;
            state.phaseRemainingMs = Math.max(0, state.phaseRemainingMs - elapsed);
            if (state.phase === "focus") {
                const studied = Math.min(elapsed, state.allocatedMs - state.studiedMs);
                state.studiedMs += studied;
                state.focusBlockRemainingMs = Math.max(0, state.focusBlockRemainingMs - studied);
            }
            state.lastUpdatedAt = until;
            if (until < state.deadline) break;
            const boundary = state.deadline;
            if (state.studiedMs >= state.allocatedMs) { finish(boundary, "completed"); break; }
            if (state.phase === "focus") beginBreak(boundary);
            else beginFocus(boundary, state.focusBlockRemainingMs > 0);
        }
        return snapshot();
    }

    return {
        snapshot,
        tick,
        start(input) {
            const allocatedMs = Math.round(input.allocatedMinutes * 60000);
            if (!input.subjectId || typeof input.subjectName !== "string" || !input.subjectName.trim()
                || !Number.isSafeInteger(allocatedMs) || allocatedMs <= 0) throw new Error("Informe uma matéria e um tempo de foco positivo.");
            config();
            const at = now();
            state = { subjectId: input.subjectId, subjectName: input.subjectName.trim(), scheduleEntryId: input.scheduleEntryId || null,
                sessionId: input.sessionId || `study-${++serial}`, allocatedMs, studiedMs: 0,
                focusBlockRemainingMs: 0, phaseRemainingMs: 0, cycle: 0, cycleLimit: 0, block: 0,
                startedAt: at, endedAt: null, endReason: null, suspended: false, paused: false };
            beginFocus(at);
            return snapshot();
        },
        pause() {
            const at = now();
            tick(at);
            if (state && state.phase !== "ended" && !state.suspended && !state.paused) {
                state.paused = true;
                state.deadline = null;
            }
            return snapshot();
        },
        resume() {
            const at = now();
            tick(at);
            if (state?.paused && !state.suspended) {
                state.paused = false;
                state.lastUpdatedAt = at;
                state.deadline = at + state.phaseRemainingMs;
            } else if (state?.phase === "break" && !state.suspended) beginFocus(at, state.focusBlockRemainingMs > 0);
            return snapshot();
        },
        suspend() {
            tick();
            if (state && state.phase !== "ended" && !state.suspended) {
                state.suspended = true;
                state.deadline = null;
            }
            return snapshot();
        },
        restore(paused = false) {
            if (state?.suspended) {
                state.suspended = false;
                if (paused) state.paused = true;
                state.lastUpdatedAt = now();
                state.deadline = state.paused ? null : state.lastUpdatedAt + state.phaseRemainingMs;
            }
            return snapshot();
        },
        end() {
            const at = now();
            tick(at);
            if (state && state.phase !== "ended") finish(at, "early");
            return snapshot();
        },
    };
}
