import { registerPageSetup } from "./router.js";
import { pageType } from "../util/enum.js";
import { plan } from "../state/scheduleState.js";
import { validatePomodoroSettings } from "../util/pomodoro.js";
import { suspendForPomodoroSettings, restoreFromPomodoroSettings } from "../state/studyTimer.js";
import { showStudyTimer } from "./studySession.js";

function setupPomodoroSettings() {
    suspendForPomodoroSettings();
    const form = document.querySelector("#pomodoro-settings-form");
    const error = document.querySelector("#pomodoro-settings-error");
    const config = plan.pomodoro || { focus: "00:25", pause: "00:05", cycles: 4 };

    form.elements.focus.value = config.focus;
    form.elements.pause.value = config.pause;
    form.elements.cycles.value = String(config.cycles);

    form.addEventListener("input", () => { error.textContent = ""; });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const nextConfig = {
            focus: form.elements.focus.value,
            pause: form.elements.pause.value,
            cycles: Number(form.elements.cycles.value),
        };
        const validationError = validatePomodoroSettings(nextConfig);
        if (validationError) {
            error.textContent = validationError;
            return;
        }
        plan.pomodoro = nextConfig;
        restoreFromPomodoroSettings();
        showStudyTimer();
    });
}

registerPageSetup(pageType.POMODORO_SETTINGS, setupPomodoroSettings);
