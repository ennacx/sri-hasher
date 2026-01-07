const SERVICE_CACHE_NAME = "sri-hasher-cache-{{GIT_HASH}}";
const SERVICE_FILES_TO_CACHE = [
	// Resources
    "./",
    "./index.html",
	"./readme.html",
    "./index.js",
	"./reg-service-worker.js",
    "./sri-hasher.css",
    "./manifest.json",
	"./favicon.ico",
	"./resources/icon-256.png",
	"./resources/icon-512.png",
	"./vendor/bootstrap-5.3.8.min.css",
	"./vendor/bootstrap-5.3.8.min.js",
	"./vendor/jquery-3.7.1.min.js",
	"./vendor/jquery-ui-1.14.1.min.js",
	"./vendor/bootstrap-icons-1.13.1/bootstrap-icons.min.css",
	// Fonts
	"./vendor/fonts/AtkinsonHyperlegibleMono-Regular.woff2",
	"./vendor/fonts/NotoSansJP-Regular.woff2",
	"./vendor/bootstrap-icons-1.13.1/fonts/bootstrap-icons.woff2"
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
