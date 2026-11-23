import { registerPageSetup, navigate } from "./router.js";
import { pageType } from "../util/enum.js";
import { formatTimerDuration } from "../util/studyTimer.js";
import { toRoman } from "../util/roman.js";
import { mountClepsydras, updateClepsydra } from "../components/clepsydra.js";
import {
    startStudySession as startTimer, ensureStudySession, getStudyTimerState, refreshStudyTimer,
    subscribeStudyTimer, updateStudySessionDraft, restoreFromPomodoroSettings
} from "../state/studyTimer.js";

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
    if (!next || next.type === "complete") return "A seguir · conclusão";
    const minutes = next.durationMs / 60000;
    const duration = Number.isInteger(minutes) ? `${minutes} min` : formatTimerDuration(next.durationMs);
    return `A seguir · ${next.type === "break" ? "pausa" : "foco"} de ${duration}`;
}

function setButtonLabel(id, text) {
    const button = document.querySelector(`#${id}`);
    if (!button) return;
    const label = button.querySelector(".btn-label");
    if (label) label.textContent = text;
    else button.textContent = text;
}

// A ampulheta avança com a areia restante: 1 = cheia, 0 = vazia.
function updateProgress(card, state) {
    if (!card) return;
    const fallbackPhase = card.querySelector("#break-countdown") ? "break" : "focus";
    if (!state) {
        updateClepsydra(card, { progress: 1, phase: fallbackPhase, paused: false });
        return;
    }
    const remaining = Math.max(0, state.phaseRemainingMs || 0);
    const total = state.phaseDurationMs
        || (state.phase === "break" ? state.breakDurationMs : state.focusDurationMs)
        || state.allocatedMs
        || remaining;
    const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    updateClepsydra(card, { progress, phase: state.phase || fallbackPhase, paused: Boolean(state.paused) });
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
            ? `Tempo consagrado: ${formatTimerDuration(state.allocatedMs)}`
            : "Inicie uma sessão escolhendo a matéria e o tempo.";

        const cycleEl = document.querySelector("#session-cycle");
        if (cycleEl) {
            cycleEl.textContent = state ? `${toRoman(state.cycle)} / ${toRoman(state.cycleLimit)}` : "";
            cycleEl.setAttribute("aria-label", state ? `Ciclo ${state.cycle} de ${state.cycleLimit}` : "");
        }

        const phaseEl = document.querySelector("#session-phase-label");
        if (phaseEl) phaseEl.textContent = state?.phase === "break" ? "Pausa" : "Foco";

        const countdownEl = document.querySelector("#session-countdown");
        countdownEl.textContent = formatTimerDuration(state?.phaseRemainingMs || 0);
        updateProgress(countdownEl.closest(".focus-card"), state);

        const pauseButton = document.querySelector("#study-session-pause");
        pauseButton.disabled = !state;
        pauseButton.setAttribute("aria-pressed", String(Boolean(state?.paused)));
        setButtonLabel("study-session-pause", state?.paused ? "Retomar" : "Pausar");
        document.querySelector("#study-session-end").disabled = !state;
    }

    if (pause) {
        pause.textContent = state?.subjectName || "Nenhuma sessão em andamento";
        document.querySelector("#break-topic").textContent = state?.topicName || "";
        document.querySelector("#break-next-period").textContent = nextPeriodText(state);
        setButtonLabel("pomodoro-break-resume", state?.paused ? "Retomar pausa" : "Voltar ao foco");

        const phaseEl = document.querySelector("#break-phase-label");
        if (phaseEl) phaseEl.textContent = "Pausa";

        const breakCountdownEl = document.querySelector("#break-countdown");
        breakCountdownEl.textContent = formatTimerDuration(state?.phaseRemainingMs || 0);
        updateProgress(breakCountdownEl.closest(".focus-card"), state);

        document.querySelector("#break-detail").textContent = state?.focusBlockRemainingMs
            ? `Foco preservado: ${formatTimerDuration(state.focusBlockRemainingMs)}`
            : "";
    }

    if (ended) {
        ended.textContent = state ? `${state.subjectName} · ${state.topicName}` : "Nenhuma sessão encerrada";
        document.querySelector("#ended-session-duration").textContent = formatTimerDuration(state?.studiedMs || 0, false);
        document.querySelector("#ended-session-remaining").textContent = formatTimerDuration(state?.remainingMs || 0);
        document.querySelector("#ended-session-status").textContent = state
            ? state.remainingMs ? "Encerrada antes do tempo." : "Tempo concluído." : "";
        document.querySelector("#session-ended-save-home").disabled = !state;
        document.querySelector("#session-ended-back").disabled = !state?.canReturn || state.saved;
        document.querySelector("#session-ended-back").hidden = state?.endReason === "completed";
    }
}

function setupStudySession() {
    mountClepsydras();
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
    mountClepsydras();
    if (getStudyTimerState()?.suspended && !getStudyTimerState()?.confirming) restoreFromPomodoroSettings();
    renderTimer(refreshStudyTimer());
}

function setupSessionEnded() {
    const state = getStudyTimerState();
    renderTimer(state);
    // renderTimer pode ter redirecionado para a tela de foco se a sessão ainda
    // estiver em andamento; nesse caso o formulário abaixo não existe mais.
    const note = document.querySelector("#session-resume-note");
    if (!note) return;
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
        document.querySelector("#session-performance-result").textContent = draft?.performance ? `Rendimento: ${labels[draft.performance]}` : "";
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
