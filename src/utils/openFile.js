/*
  Show a file the API guards — a resignation letter, PDF or image — in a new tab.

  An <a href="/api/…"> cannot do it: the route sits behind requireAuth, and a
  browser following a link sends no Authorization header. So the bytes are
  fetched with the token (`requestBlob`) and shown from an object URL.

  The tab is opened **before** the fetch, on the click itself: a window opened
  after an await is a popup the browser blocks. It is pointed at the file once
  the bytes arrive, and closed again if they never do.

  The object URL is revoked a minute later — long enough for the new tab to have
  read it, short enough that a signed personal document does not stay reachable
  through a stale blob: link for the rest of the session (the backend sends it
  no-store for the same reason).

  @param {() => Promise<Blob>} fetchBlob
  @returns {Promise<void>} rejects with the fetch's error, the tab closed
*/
export async function openFileInNewTab(fetchBlob) {
  const tab = window.open('', '_blank');
  try {
    const blob = await fetchBlob();
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
}

/**
 * Save a guarded file under its own name (a DOCX or PPTX a browser cannot show):
 * fetched with the token, then handed to the browser through a temporary link.
 *
 * @param {() => Promise<Blob>} fetchBlob
 * @param {string} fileName
 */
export async function downloadFile(fetchBlob, fileName) {
  const blob = await fetchBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'file';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
