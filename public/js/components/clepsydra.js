/*
 * Ampulheta (clepsidra) da tela de foco.
 *
 * A marcação vive em index.html (<template id="clepsydra-template">) para não
 * repetir o SVG em duas telas. Aqui só clonamos e ligamos o estado visual:
 *   --progress  1 = ampulheta cheia, 0 = vazia (areia restante)
 *   data-phase  "focus" | "break" (areia e halo trocam de tom)
 *   is-flipping virada da ampulheta na troca de fase
 *   is-paused   congela o fluxo de areia
 */

export function mountClepsydra(slot) {
    if (!slot) return null;
    if (slot.dataset.mounted === "true") return slot.querySelector(".clepsydra");
    const template = document.querySelector("#clepsydra-template");
    if (!template) return null;
    slot.replaceChildren(template.content.cloneNode(true));
    slot.dataset.mounted = "true";
    return slot.querySelector(".clepsydra");
}

export function mountClepsydras(scope = document) {
    return [...scope.querySelectorAll("[data-clepsydra]")].map(mountClepsydra).filter(Boolean);
}

let flipTimer = null;

export function updateClepsydra(card, { progress = 1, phase = "focus", paused = false } = {}) {
    if (!card) return null;
    const clepsydra = card.querySelector(".clepsydra");
    const nextPhase = phase === "break" ? "break" : "focus";

    if (clepsydra) {
        const previous = clepsydra.dataset.phase;
        if (previous && previous !== nextPhase) {
            clepsydra.classList.remove("is-flipping");
            // força o reinício da animação (reflow intencional)
            void clepsydra.offsetWidth;
            clepsydra.classList.add("is-flipping");
            clearTimeout(flipTimer);
            flipTimer = setTimeout(() => clepsydra.classList.remove("is-flipping"), 1200);
        }
        clepsydra.dataset.phase = nextPhase;
    }

    card.classList.toggle("is-paused", Boolean(paused));
    card.classList.toggle("is-break", nextPhase === "break");
    card.style.setProperty("--progress", String(Math.max(0, Math.min(1, progress))));
    return clepsydra;
}
