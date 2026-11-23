/*
 * Camada de interface compartilhada: progresso de rolagem, revelação
 * escalonada (com respeito a prefers-reduced-motion) e estado ativo da
 * navegação lateral no desktop.
 */

let refresh = () => { };
let observer = null;
let reducedMotion = false;

const REVEAL_SELECTOR = [
    ".card-accent",
    ".empty-state-card",
    ".focus-card",
    ".finish-card",
    ".subject-list-item",
    ".home-session",
    ".schedule-day",
].join(",");

export function initUI() {
    const bar = document.querySelector("#scroll-rail span");
    const updateBar = () => {
        if (!bar) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        bar.style.transform = `scaleX(${ratio})`;
    };

    window.addEventListener("scroll", updateBar, { passive: true });
    window.addEventListener("resize", updateBar);

    reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (!reducedMotion && typeof IntersectionObserver === "function") {
        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
    }

    refresh = (scope = document) => {
        const elements = [...scope.querySelectorAll(REVEAL_SELECTOR)];
        elements.forEach((element, index) => {
            if (reducedMotion || !observer) {
                element.classList.add("is-visible");
                return;
            }
            if (element.dataset.reveal === "on") return;
            element.dataset.reveal = "on";
            element.classList.add("reveal");
            element.style.setProperty("--stagger", String(index % 6));
            observer.observe(element);
        });
        updateBar();
    };
    refresh();
}

export function refreshUI(scope) {
    refresh(scope);
}

export function syncRail(pageType) {
    const flow = {
        "study-session": "home",
        "pomodoro-break": "home",
        "session-ended": "home",
        "pomodoro-settings": "home",
        "questionnaire-days": "home",
        "questionnaire-subjects": "home",
        "schedule-settings": "home",
        "review-plan": "home",
    };
    const active = flow[pageType] || pageType;
    document.querySelectorAll(".rail-link").forEach((button) => {
        if (button.dataset.pageLink === active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });
}
