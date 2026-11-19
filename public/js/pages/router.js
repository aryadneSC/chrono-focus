// aqui é relacionado a navegação de página, ir para página, voltar etc

let previousPage = null;
let currentPage = null;

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

    activity.replaceChildren(template.content.cloneNode(true));

    previousPage = currentPage;
    currentPage = pageType;
    pageSetups[pageType]?.();
}

export function getPageTemplateID(pageType) {
    return `[data-page="${pageType}"]`;
}