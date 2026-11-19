export const plan = {
    days: [],
    preference: null,
    studyTime: "",
    studyTimeMode: "same",
    studyTimeByDay: {},
    periods: [],
    subjects: [],
    schedule: [],
    scheduleGenerated: false,
    scheduleStartDate: null,
    subjectsPerDay: 1,
    scheduleSettingsVisited: false,
    scheduleWarnings: [],
    scheduleRevision: 0,
    currentSession: null,
    sessionRecords: [],
    pomodoro: { focus: "00:25", pause: "00:05", cycles: 4 },
};

export function invalidateSchedule() {
    plan.scheduleGenerated = false;
    plan.currentSession = null;
}
