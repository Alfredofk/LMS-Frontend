/*
  YouTube's IFrame Player API, loaded once and only when a student's drawer shows
  a YouTube video it tracks (components/content/SessionContentDrawer.jsx) - the
  way GoogleButton loads gsi/client only on the sign-in screen.

  The script calls `window.onYouTubeIframeAPIReady` when it is ready; a page that
  set one before keeps it, chained. A failed load clears the promise, so the next
  drawer may try again; until then the video simply plays untracked.
*/
const SRC = 'https://www.youtube.com/iframe_api';
let loading = null;

export function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error('YouTube API failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
