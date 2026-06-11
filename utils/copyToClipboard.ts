const fallbackCopy = (text: string): boolean => {
  const el = document.createElement('textarea');
  el.value = text;

  // prevent scroll jump
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';

  document.body.appendChild(el);
  el.focus();
  el.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }

  document.body.removeChild(el);
  return success;
}

export const initCopyButtons = (root = document) => {
  root.querySelectorAll('.expressive-code .copy button').forEach((btn) => {
    if ((btn as any)._wired) {
      return;
    }
    (btn as any)._wired = true

    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-code')?.replace(/\u007f/g, '\n');
      if (!code) {
        return;
      }

      try {
        await navigator.clipboard.writeText(code);
      } catch {
        fallbackCopy(code);
      }
    })
  })
}
