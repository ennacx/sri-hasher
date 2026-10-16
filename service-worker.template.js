// Git hash: {{GIT_HASH}}

const SERVICE_CACHE_PREFIX = "sri-hasher-cache-{{GIT_HASH}}";

const OLD_HOME = new URL('./', self.location.href).href;
const NEW_HOME = 'https://ennacx.github.io/web-technica/sri-hasher/';

self.addEventListener('install', (event) => {
    // 既存キャッシュを削除したりリダイレクト用HTMLで上書きしたりしない
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // ページ遷移以外は従来どおり処理する。
    if(request.mode !== 'navigate'){
        event.respondWith(caches.match(request).then((cached) => (cached || fetch(request))));

        return;
    }

    // 旧アプリのトップページだけを対象に
    const url = new URL(request.url);

    if(url.href !== OLD_HOME && url.href !== `${OLD_HOME}index.html`){
        return;
    }

    event.respondWith((async () => {
        try{
            // 旧サイトのネットワーク到達性を確認しキャッシュ経由ではないことを意図する
            const response = await fetch(
                new Request(OLD_HOME, {
                    cache: 'no-store',
                })
            );

            if(!response.ok){
                throw new Error('Network unavailable');
            }

            // 通信できたので新サイトへ移動。
            return Response.redirect(NEW_HOME, 302);

        } catch(e){
            // オフラインなら既存の旧アプリキャッシュを新しい順に探す
            const cacheNames = (await caches.keys())
                .filter((name) => name.startsWith(SERVICE_CACHE_PREFIX))
                .reverse();

            for(const cacheName of cacheNames){
                const cached = (
                    await caches.match(OLD_HOME, { cacheName }) ??
                    await caches.match(`${OLD_HOME}index.html`, { cacheName })
                );

                if(cached){
                    return cached;
                }
            }

            return Response.error();
        }
    })());
});

self.addEventListener('activate', (event) => {
    // 既存キャッシュは保持
    event.waitUntil(self.clients.claim());
});
