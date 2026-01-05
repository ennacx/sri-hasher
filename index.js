const ALLOWED_EXTENSIONS = ['js', 'css', 'wasm'];

let sri;
let sriTag;
let extension;

function getExtension(target) {
	const name = (target instanceof URL) ? target.pathname : target;
	return name.split('.').pop();
}
function validateURL(u) {
	try {
		const url = new URL(u);
		if(!url.protocol.match(/^https?:$/)){
			return false;
		} else{
			const ext = getExtension(url);
			if(!ALLOWED_EXTENSIONS.includes(ext)){
				return false;
			}

			extension = ext;
		}

		return true;
	} catch(e){
		console.error(e);

		return false;
	}
}

async function fetchContent(url) {
	const response = await fetch(url);

	if(!response.ok){
		throw new Error(`Fetch failed: ${response.status} - ${response.statusText}`);
	}

	return await response.arrayBuffer();
}

async function probeCorsReadable(url) {
	const tryFetch = async (method) => await fetch(url, { method, mode: 'cors', cache: 'no-store' });

	try {
		let res;
		try {
			res = await tryFetch('HEAD');
		} catch {
			res = await tryFetch('GET');
		}

		return { readable: true, status: res.status, contentType: res.headers.get('content-type') };
	} catch (e) {
		return { readable: false, reason: 'fetch_failed', error: e };
	}
}

function validateFile(name) {
	const ext = getExtension(name);
	if(!ALLOWED_EXTENSIONS.includes(ext)){
		return false;
	}

	extension = ext;

	return true;
}

// WebCrypto: "SHA-384" -> SRI: "sha384-"
function algoToSriPrefix(algo) {
	const algoBit = algo.replace(/^SHA\-(256|384|512)$/i, '$1');

	return `sha${algoBit}-`;
}

function arrayBufferToBase64(buf) {
	const bytes = new Uint8Array(buf);
	const chunk = 0x8000;

	let bin = '';
	for(let i = 0; i < bytes.length; i += chunk){
		bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}

	return btoa(bin);
}

async function sriFromArrayBuffer(arrayBuffer, algo) {
	const digest = await crypto.subtle.digest(algo, arrayBuffer);
	const base64 = arrayBufferToBase64(digest);

	return algoToSriPrefix(algo) + base64;
}

function makeHtmlTag(url, hash) {
	switch(extension){
		case 'js':
			return `<script src="${url}" integrity="${hash}" crossorigin="anonymous"></script>`;
		case 'wasm':
			return `<script type="module" src="${url}" integrity="${hash}" crossorigin="anonymous"></script>`;
		case 'css':
			return `<link rel="stylesheet" href="${url}" integrity="${hash}" crossorigin="anonymous">`;
		default:
			throw new Error(`Unknown extension: ${extension}`);
	}
}

function copyToClipboard(text) {
	if(navigator.clipboard && window.isSecureContext){
		return navigator.clipboard.writeText(text);
	} else{
		// フォールバック処理
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed'; // iOS対策
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();

		try {
			document.execCommand('copy');
		} catch(e){
			console.error("クリップボードコピー失敗:", e);
			alert("コピーできませんでした。手動で選択してください。");
		} finally{
			document.body.removeChild(textarea);
		}

		return Promise.resolve();
	}
}

$(() => {
	const $errorAlert = $('#error-alert');
	const $resultCard = $('#result');
	const $urlForm = $('input[name="url"]');
	const $uploadForm = $('input[name="upload-file"]')[0];

	const showAlert = (msg) => {
		$errorAlert.text(msg);
		$errorAlert.show();
	};
	const hideAlert = () => {
		$errorAlert.hide();
		$errorAlert.empty();
	};

	$('button[name="generate-hash"]').click(async () => {
		extension = undefined;
		sri = undefined;
		sriTag = undefined;

		hideAlert();
		$resultCard.hide();

		const url     = $urlForm.val().trim();
		const file    = $uploadForm.files[0] ?? null;
		const sriHash = $('select[name="sri-hash"] option:selected').val();

		let mode;
		let errMsg;

		if(url){
			mode = 'fetch';
		} else if(file?.size > 0){
			mode = 'upload';
		}
		// 不正
		else{
			showAlert('URL or file is required');

			return false;
		}

		if(mode === 'fetch'){
			if(!validateURL(url)){
				errMsg = 'Invalid URL or invalid file type';
			} else{
				probeCorsReadable(url)
					.then((res) => {
						if(!res.readable){
							errMsg = `Fetch failed: ${res.error.message}`;
						}
					})
					.catch((e) => {
						console.error(e);
					})
				;
			}
		}
		else if(mode === 'upload'){
			if(!validateFile(file.name)){
				errMsg = 'Invalid file type';
			}
		}

		if(errMsg){
			showAlert(errMsg);

			return false;
		}

		try {
			let resBuffer;
			let src;

			if(mode === 'fetch'){
				resBuffer = await fetchContent(url);
				src = url;
			} else if(mode === 'upload'){
				resBuffer = await file.arrayBuffer();
				src = file.name;
			}

			sri = await sriFromArrayBuffer(resBuffer, sriHash);
			sriTag = makeHtmlTag(src, sri);

			$('#sri > pre').text(sri);
			$('#sri-tag > pre').text(sriTag);

			$resultCard.show();
		} catch(e){
			console.error(e);

			showAlert(e.message);
		}
	});

	const copyBtnTimeoutIds = {};
	$('button.copy-btn').click(function(){
		const $this = $(this);
		const attribute = $this.attr('id').replace(/^copy-/, '');

		// 再度ボタンが有効化になるまでの時間 (ms)
		const enableDuration = 3000;

		let text;
		if(attribute === 'sri'){
			text = sri;
		} else if(attribute === 'sri-tag'){
			text = sriTag;
		} else{
			throw new Error(`Invalid attribute: ${attribute}`);
		}

		copyToClipboard(text)
			.then(() => {
				const btnLabelHtml = $this.html();
				const iFind = () => $this.find('i');

				$this.prop('disabled', true);
				$this.html('<i class="bi bi-check2"></i> Copied!');
				iFind().addClass('btn-fade');

				// 1秒後にフェードアウト開始
				setTimeout(() => {
					iFind().addClass('fade-out');
				}, enableDuration - 300); // 残り0.5秒でフェード開始

				// 完全に消えたらリセット
				copyBtnTimeoutIds[attribute] = setTimeout(() => {
					$this.html(btnLabelHtml);
					$this.prop('disabled', false);

					copyBtnTimeoutIds[attribute] = null;
				}, enableDuration);
			})
			.catch((e) => {
				console.error(e);

				window.alert("コピーに失敗しました。");
			})
		;
	});
})