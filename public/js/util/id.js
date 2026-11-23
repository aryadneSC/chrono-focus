/*
 * Identificadores sem depender de "contexto seguro".
 *
 * `crypto.randomUUID()` só existe em HTTPS ou localhost. Servindo o app em
 * `http://192.168.x.x:8000` (celular na mesma rede, por exemplo) ele é
 * `undefined` e o cadastro de matérias/sessões quebrava com
 * "crypto.randomUUID is not a function".
 *
 * Esta função usa randomUUID quando disponível e cai para um UUID v4 gerado
 * com `crypto.getRandomValues` (que funciona em contexto inseguro) ou, no
 * limite, `Math.random`.
 */

let sequence = 0;

function fallbackUuid() {
    const bytes = new Uint8Array(16);
    const webCrypto = globalThis.crypto;
    if (typeof webCrypto?.getRandomValues === "function") {
        webCrypto.getRandomValues(bytes);
    } else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createId(prefix = "") {
    let id = "";
    try {
        if (typeof globalThis.crypto?.randomUUID === "function") id = globalThis.crypto.randomUUID();
    } catch {
        id = "";
    }
    if (!id) id = `${fallbackUuid()}-${++sequence}`;
    return prefix ? `${prefix}${id}` : id;
}
