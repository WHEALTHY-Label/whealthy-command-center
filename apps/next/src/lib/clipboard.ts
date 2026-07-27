/**
 * Copy text to the clipboard the way the live app did (index.html:5546-5560).
 *
 * `navigator.clipboard` is unavailable on a page served over plain HTTP, and
 * Safari refuses it outright when the write is not inside a user gesture it
 * recognises. Legacy caught both cases with a hidden textarea and the old
 * `execCommand('copy')`, so a steward on an older phone still got his link.
 * The port had dropped the fallback and simply told him copying failed.
 *
 * Returns true when the text made it to the clipboard by either route.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea route below.
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    // `execCommand` is deprecated on purpose here: the whole point of this
    // branch is the pre-Clipboard-API path, which is what the live app fell
    // back to and what older mobile Safari still needs.
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
