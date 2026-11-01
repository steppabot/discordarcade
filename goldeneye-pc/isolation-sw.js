// Retired. The first GoldenEye beta needed this worker to isolate the page for
// threads; the current build runs on one thread and needs nothing. Browsers that
// installed the old worker pick this version up on their next visit, and it
// removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.registration.unregister()));
