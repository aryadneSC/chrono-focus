import { registerPageSetup, navigate } from "./router.js";
import { pageType } from "../util/enum.js";
import { plan } from "../state/scheduleState.js";
import { mountScheduleControls } from "../components/scheduleControls.js";

function setupScheduleSettings() {
    const controls = mountScheduleControls();
    document.querySelector("#schedule-settings-next").addEventListener("click", () => {
        if (!controls.validate()) return;
        Object.assign(plan, controls.values(), { scheduleSettingsVisited: true });
        navigate(pageType.REVIEW_PLAN);
    });
}
registerPageSetup(pageType.SCHEDULE_SETTINGS, setupScheduleSettings);
