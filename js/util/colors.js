/* Cor estável por matéria — a mesma matéria tem a mesma cor em toda a tela. */
const PALETTE = ["#5431A4", "#F3711B", "#D04224", "#3E9E5E", "#3B6FA8", "#F2B32E", "#8E4EC6", "#2A9D8F"];

export function subjectColor(id = "") {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
        hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    }
    return PALETTE[hash % PALETTE.length];
}

export { PALETTE };
