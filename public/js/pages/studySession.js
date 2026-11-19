import { registerPageSetup, navigate } from "./router.js";
import { pageType } from "../util/enum.js";
import { formatTimerDuration } from "../util/studyTimer.js";
import { startStudySession as startTimer, ensureStudySession, getStudyTimerState, refreshStudyTimer,
    subscribeStudyTimer, updateStudySessionDraft, restoreFromPomodoroSettings } from "../state/studyTimer.js";

export function showStudyTimer() {
    const state = getStudyTimerState();
    navigate(state?.confirming ? pageType.SESSION_ENDED : state?.phase === "break" ? pageType.POMODORO_BREAK : pageType.STUDY_SESSION);
}

// Public integration entry for sessions planned by subject.
export function startStudySession(input) {
    const state = startTimer(input);
    showStudyTimer();
    return state;
}

function nextPeriodText(state) {
    const next = state?.nextPeriod;
    if (!next || next.type === "complete") return "Próximo período: conclusão da sessão";
    const minutes = next.durationMs / 60000;
    const duration = Number.isInteger(minutes) ? `${minutes} ${minutes === 1 ? "minuto" : "minutos"}` : formatTimerDuration(next.durationMs);
    return `Próximo período: ${next.type === "break" ? "pausa" : "foco"} de ${duration}`;
}

function renderTimer(state) {
    const focus = document.querySelector("#session-subject");
    const pause = document.querySelector("#break-subject");
    const ended = document.querySelector("#ended-session-context");
    if (!focus && !pause && !ended) return;
    if (state && ((state.confirming && !ended) || (!state.confirming && ended)
        || (!state.confirming && ((focus && state.phase !== "focus") || (pause && state.phase !== "break"))))) {
        showStudyTimer();
        return;
    }
    if (focus) {
        focus.textContent = state?.subjectName || "Nenhuma sessão em andamento";
        document.querySelector("#session-topic").textContent = state?.topicName || "";
        document.querySelector("#session-next-period").textContent = nextPeriodText(state);
        document.querySelector("#session-planned-duration").textContent = state
            ? `Foco destinado à matéria: ${formatTimerDuration(state.allocatedMs)}` : "Inicie uma sessão informando a matéria e o tempo destinado a ela.";
        document.querySelector("#session-cycle").textContent = state ? `Bloco ${state.cycle} de ${state.cycleLimit}` : "";
        document.querySelector("#session-countdown").textContent = formatTimerDuration(state?.phaseRemainingMs || 0);
        document.querySelector("#study-session-pause").disabled = !state;
        document.querySelector("#study-session-pause").textContent = state?.paused ? "RETOMAR" : "PAUSAR";
        document.querySelector("#study-session-pause").setAttribute("aria-pressed", String(Boolean(state?.paused)));
        document.querySelector("#study-session-end").disabled = !state;
    }
    if (pause) {
        pause.textContent = state?.subjectName || "Nenhuma sessão em andamento";
        document.querySelector("#break-topic").textContent = state?.topicName || "";
        document.querySelector("#break-next-period").textContent = nextPeriodText(state);
        document.querySelector("#pomodoro-break-resume").textContent = state?.paused ? "Retomar pausa" : "Retomar sessão";
        document.querySelector("#break-countdown").textContent = formatTimerDuration(state?.phaseRemainingMs || 0);
        document.querySelector("#break-detail").textContent = state?.focusBlockRemainingMs
            ? `Foco preservado neste bloco: ${formatTimerDuration(state.focusBlockRemainingMs)}.` : "A pausa será seguida pelo próximo bloco de foco.";
    }
    if (ended) {
        ended.textContent = state ? `${state.subjectName} · ${state.topicName}` : "Nenhuma sessão encerrada";
        document.querySelector("#ended-session-duration").textContent = `Tempo efetivamente estudado: ${formatTimerDuration(state?.studiedMs || 0, false)}`;
        document.querySelector("#ended-session-remaining").textContent = `Tempo restante da matéria: ${formatTimerDuration(state?.remainingMs || 0)}`;
        document.querySelector("#ended-session-status").textContent = state
            ? state.remainingMs ? "Sessão encerrada antecipadamente." : "Tempo destinado à matéria concluído." : "";
        document.querySelector("#session-ended-save-home").disabled = !state;
        document.querySelector("#session-ended-back").disabled = !state?.canReturn || state.saved;
        document.querySelector("#session-ended-back").hidden = state?.endReason === "completed";
    }
}

function setupStudySession() {
    try {
        if (getStudyTimerState()?.suspended && !getStudyTimerState()?.confirming) restoreFromPomodoroSettings();
        renderTimer(ensureStudySession());
    }
    catch (error) {
        renderTimer(getStudyTimerState());
        const message = document.querySelector("#session-error, #break-error");
        if (message) message.textContent = error.message;
    }
}

function setupBreak() {
    if (getStudyTimerState()?.suspended && !getStudyTimerState()?.confirming) restoreFromPomodoroSettings();
    renderTimer(refreshStudyTimer());
}

function setupSessionEnded() {
    const state = getStudyTimerState();
    renderTimer(state);
    const note = document.querySelector("#session-resume-note");
    const radios = document.querySelectorAll('input[name="session-performance"]');
    const completed = document.querySelector("#session-topic-completed");
    const completedToday = document.querySelector("#session-topic-completed-today");
    completed.checked = Boolean(state?.draft.topicCompleted);
    completed.disabled = Boolean(state?.saved || state?.isTest || !state?.topicId);
    completedToday.checked = Boolean(state?.draft.topicCompletedToday);
    completedToday.disabled = completed.disabled;
    note.value = state?.draft.resumeNote || "";
    radios.forEach((radio) => { radio.checked = radio.value === state?.draft.performance; radio.disabled = Boolean(state?.saved); });
    note.disabled = Boolean(state?.saved);
    function update() {
        updateStudySessionDraft({ performance: [...radios].find((radio) => radio.checked)?.value || "", resumeNote: note.value, topicCompleted: completed.checked, topicCompletedToday: completedToday.checked });
        const draft = getStudyTimerState()?.draft;
        const labels = { low: "Baixo", medium: "Médio", good: "Bom" };
        document.querySelector("#session-note-count").textContent = `${draft?.resumeNote.length || 0}/200 caracteres`;
        document.querySelector("#session-performance-result").textContent = draft?.performance ? `Rendimento selecionado: ${labels[draft.performance]}` : "";
    }
    note.addEventListener("input", update);
    completed.addEventListener("change", update);
    completedToday.addEventListener("change", update);
    radios.forEach((radio) => radio.addEventListener("change", update));
    update();
}

subscribeStudyTimer(renderTimer);
window.addEventListener("focus", refreshStudyTimer);
document.addEventListener("visibilitychange", refreshStudyTimer);
registerPageSetup(pageType.STUDY_SESSION, setupStudySession);
registerPageSetup(pageType.POMODORO_BREAK, setupBreak);
registerPageSetup(pageType.SESSION_ENDED, setupSessionEnded);
