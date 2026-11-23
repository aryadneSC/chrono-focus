// aqui é relacionado a navegação de página, ir para página, voltar etc
import { refreshUI, syncRail } from "../util/ui.js";

let previousPage = null;
let currentPage = null;
let transitionRunning = false;

const activity = document.querySelector("#activity");

const pageSetups = {};

export function registerPageSetup(pageType, setupFn) {
    pageSetups[pageType] = setupFn;
}

export function navigate(pageType) {
    const template = document.querySelector(getPageTemplateID(pageType));

    if (!template) {
        console.error(`Template para "${pageType}" não encontrado, os templates existentes são: 
            \n${Array.from(document.querySelectorAll("[data-page]")).map((t) => t.dataset.page).join(", ")}`);
        return;
    }

    previousPage = currentPage;
    currentPage = pageType;

    let committed = false;
    // Troca de DOM + setup numa única "captura" para a View Transitions API.
    // `committed` protege contra uma segunda chamada (setup que redireciona).
    const commit = () => {
        if (committed) return;
        committed = true;
        activity.replaceChildren(template.content.cloneNode(true));
        if (window.scrollY > 0) window.scrollTo(0, 0);
        pageSetups[pageType]?.();
        syncRail(pageType);
        refreshUI(activity);
    };

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const canTransition = typeof document.startViewTransition === "function" && !reducedMotion && !transitionRunning;
    if (!canTransition) {
        commit();
        return;
    }

    transitionRunning = true;
    try {
        const transition = document.startViewTransition(commit);
        transition.ready?.catch(() => { });
        transition.finished?.catch(() => { }).finally(() => { transitionRunning = false; });
    } catch {
        transitionRunning = false;
        commit();
    }
}

export function getPageTemplateID(pageType) {
    return `[data-page="${pageType}"]`;
}
