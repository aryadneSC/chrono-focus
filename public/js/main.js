import { navigate } from "./pages/router.js";
import { initUI } from "./util/ui.js";
import { pageType } from "./util/enum.js";
import { plan, invalidateSchedule } from "./state/scheduleState.js";
import { validateRoutineForm } from "./pages/questionnaireDays.js";
import { showSubjectEditor } from "./pages/subjects.js";
import "./pages/reviewPlan.js";
import "./pages/schedule.js";
import "./pages/scheduleSettings.js";
import "./pages/pomodoroSettings.js";
import "./pages/home.js";
import { showStudyTimer, startStudySession } from "./pages/studySession.js";
import { pauseStudySession, resumeStudySession, endStudySession, returnFromSessionEnd, restoreFromPomodoroSettings, saveStudySession, getStudyTimerState } from "./state/studyTimer.js";
import { regenerateSchedule } from "./state/scheduleService.js";
import { validateScheduleConfig } from "./util/scheduleConfig.js";

initUI();
navigate(pageType.WELCOME);

document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const linkedPage = button.dataset.pageLink;
    if (linkedPage) {
        if (button.closest(".test-session-card")) {
            try { startStudySession({ subjectId: "test", subjectName: "Sessão fictícia", allocatedMinutes: 25, isTest: true }); }
            catch (error) { showStudyTimer(); }
            return;
        }
        navigate(linkedPage);
        return;
    }
    switch (button.id) {
        case "welcome-start": navigate(pageType.QUESTIONNAIRE_DAYS); break;
        case "questionnaire-days-back": initUI();
navigate(pageType.WELCOME); break;
        case "questionnaire-days-next":
            if (validateRoutineForm()) navigate(pageType.QUESTIONNAIRE_SUBJECTS);
            break;
        case "questionnaire-subjects-back": navigate(pageType.QUESTIONNAIRE_DAYS); break;
        case "questionnaire-subjects-next":
            if (plan.subjects.length < 2) {
                document.querySelector("#subjects-error").textContent = "Grave pelo menos 2 disciplinas para revisar o plano.";
                document.querySelector("#add-subject").focus();
            } else navigate(pageType.SCHEDULE_SETTINGS);
            break;
        case "review-back": navigate(pageType.SCHEDULE_SETTINGS); break;
        case "review-edit-routine": navigate(pageType.QUESTIONNAIRE_DAYS); break;
        case "welcome-skip": navigate(pageType.HOME); break;
        case "review-save": {
            if (!plan.scheduleSettingsVisited) {
                navigate(pageType.SCHEDULE_SETTINGS);
                break;
            }
            const configError = validateScheduleConfig(plan);
            if (configError) {
                document.querySelector("#review-schedule").textContent = configError;
                break;
            }
            const result = plan.scheduleGenerated ? { ok: true } : regenerateSchedule();
            if (result.ok) navigate(pageType.HOME);
            else document.querySelector("#review-schedule").textContent = result.error;
            break;
        }
        case "study-session-end":
        case "pomodoro-break-end":
            endStudySession();
            showStudyTimer();
            break;
        case "study-session-pause":
            if (getStudyTimerState()?.paused) resumeStudySession();
            else pauseStudySession();
            break;
        case "pomodoro-settings-back":
            restoreFromPomodoroSettings();
            showStudyTimer();
            break;
        case "pomodoro-break-resume":
            resumeStudySession();
            showStudyTimer();
            break;
        case "session-ended-back":
            returnFromSessionEnd();
            showStudyTimer();
            break;
        case "session-ended-save-home":
            saveStudySession();
            navigate(pageType.HOME);
            break;

    }

    const action = button.dataset.action;
    const id = button.dataset.subjectId;
    if (action === "edit-subject") {
        if (!document.querySelector("#subjects-list")) navigate(pageType.QUESTIONNAIRE_SUBJECTS);
        showSubjectEditor(id);
    } else if (action === "remove-subject") {
        plan.subjects = plan.subjects.filter((subject) => subject.id !== id);
        invalidateSchedule();
        if (document.querySelector("#subjects-list")) {
            navigate(document.querySelector("#questionnaire-subjects-next") ? pageType.QUESTIONNAIRE_SUBJECTS : pageType.SUBJECTS);
        } else if (plan.subjects.length < 2) navigate(pageType.QUESTIONNAIRE_SUBJECTS);
        else navigate(pageType.REVIEW_PLAN);
    }
});

