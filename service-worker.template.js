const SERVICE_CACHE_NAME = "sri-hasher-cache-{{GIT_HASH}}";
const SERVICE_FILES_TO_CACHE = [
	// Resources
    "./",
    "./index.html",
    "./index.js",
	"./reg-service-worker.js",
    "./sri-hasher.css",
    "./manifest.json",
	"./favicon.ico",
	"./resources/icon-256.png",
	"./resources/icon-512.png",
	// CDN
	"https://code.jquery.com/jquery-3.7.1.min.js",
	"https://code.jquery.com/ui/1.14.1/jquery-ui.min.js",
	"https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.min.js",
	"https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css",
	"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css",
	// WebFont
	"https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:ital,wght@0,200..800;1,200..800&family=Noto+Sans+JP:wght@100..900&display=swap"
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SERVICE_CACHE_NAME)
            .then((cache) => cache.addAll(SERVICE_FILES_TO_CACHE))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュがあればそれを返す、なければネットから取得
                return response || fetch(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keyList) => Promise.all(
                keyList.map((key) => {
                    if(key !== SERVICE_CACHE_NAME){
                        return caches.delete(key);
                    }
                })
            ))
    );
});
