import assert from "node:assert/strict";
import test from "node:test";
import { generateSchedule } from "../public/js/util/scheduler.js";
import { createStudyTimer } from "../public/js/util/studyTimer.js";

test("inclui a matéria no dia do prazo e a retira dos dias seguintes", () => {
    const subjects = [
        { id: "math", name: "Matemática", importance: "high", difficulty: "high", deadline: "2026-11-17" },
        { id: "history", name: "História", importance: "medium", difficulty: "medium" },
    ];
    const routine = {
        days: ["seg", "ter", "qua"],
        preference: "fixed-time",
        studyTimeMode: "same",
        studyTime: "01:00",
        scheduleStartDate: "2026-11-16",
        subjectsPerDay: 2,
        subjects,
    };

    const { days } = generateSchedule(routine, new Date(2026, 10, 16), 0, 3);

    assert.ok(days[1].sessions.some(({ subjectId }) => subjectId === "math"));
    assert.deepEqual(days[2].sessions.map(({ subjectId }) => subjectId), ["history"]);
});

test("encerra o timer ao esgotar o foco sem contabilizar a pausa", () => {
    const timer = createStudyTimer({
        now: () => 0,
        getConfig: () => ({ focus: "00:25", pause: "00:05", cycles: 4 }),
    });
    timer.start({ subjectId: "math", subjectName: "Matemática", allocatedMinutes: 30 });

    assert.equal(timer.tick(27 * 60_000).studiedMs, 25 * 60_000);

    const result = timer.tick(40 * 60_000);
    assert.equal(result.phase, "ended");
    assert.equal(result.endReason, "completed");
    assert.equal(result.studiedMs, 30 * 60_000);
    assert.equal(result.endedAt, 35 * 60_000);
});
