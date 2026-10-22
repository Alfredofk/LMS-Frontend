/*
  Copy text to the clipboard, on plain http too (the app is tested from a phone over
  http://10.20.x.x, where navigator.clipboard is undefined): the modern path first,
  then the deprecated execCommand, which is the only thing that works there. Answers
  whether it worked. Moved here from SchoolCodeCard (2026-10-22).
*/
export const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Refused, or an insecure context that exposed the API anyway. Fall
         through rather than reporting a failure we have not had yet. */
    }
  }

  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    field.style.opacity = '0';
    document.body.appendChild(field);

    field.select();
    /* iOS Safari ignores select() on a readonly field without this. */
    field.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
};
