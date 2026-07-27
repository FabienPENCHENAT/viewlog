// Copie dans le presse-papiers. Reste local au navigateur : rien n'est envoyé.
// L'API Clipboard n'existe qu'en contexte sécurisé (HTTPS ou localhost), d'où
// le repli. Ne lève jamais : renvoie true si la copie a abouti.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* on tente le repli ci-dessous */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
