const SCRIPT_URL_STORAGE_KEY = "chrono_focus_apps_script_url";
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzd9lRvcQ_voC1BReUjl6iXaXa-OiB5sowWy5wsER3atgGTGa5-rVraSIP0CNTbX15k/exec";

function normalizeScriptUrl(rawUrl) {
    if (typeof rawUrl !== "string") return "";
    const cleaned = rawUrl.trim().replace(/[;)]+$/, "");
    try {
        const parsed = new URL(cleaned);
        if (parsed.protocol === "https:" && parsed.hostname === "script.google.com") {
            return parsed.toString();
        }
    } catch {
        return "";
    }
    return "";
}

export function setAutomationWebhook(url) {
    const validUrl = normalizeScriptUrl(url);
    if (!validUrl) {
        localStorage.removeItem(SCRIPT_URL_STORAGE_KEY);
        return;
    }
    localStorage.setItem(SCRIPT_URL_STORAGE_KEY, validUrl);
}

export function getAutomationWebhook() {
    const stored = localStorage.getItem(SCRIPT_URL_STORAGE_KEY);
    return normalizeScriptUrl(stored) || normalizeScriptUrl(DEFAULT_APPS_SCRIPT_URL);
}

export async function notifyAutomation(eventName, payload = {}) {
    const scriptUrl = getAutomationWebhook();
    if (!scriptUrl) return { skipped: true };

    try {
        await fetch(scriptUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                app: "Chrono Focus",
                event: eventName,
                timestamp: new Date().toISOString(),
                data: payload,
            }),
        });
        return { ok: true, opaque: true };
    } catch (error) {
        console.warn("[Chrono Focus] Não foi possível enviar para o Google Apps Script:", error);
        return { ok: false };
    }
}