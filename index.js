const ALLOWED_EXTENSIONS = ['js', 'css', 'wasm'];

/**
 * Represents an object containing Subresource Integrity (SRI) information.
 * This structure is used to manage SRI values, SRI tags, and related file extensions.
 *
 * @typedef {Object} sriSet
 * @property {string|undefined} sri - The Subresource Integrity hash value. Typically used for verifying resource integrity.
 * @property {string|undefined} sriTag - The HTML tag or identifier associated with the SRI, used to apply the integrity attribute to a resource.
 * @property {string|undefined} extension - The file extension associated with the resource, used for identifying specific file types.
 */
const sriSet = {
	sri: undefined,
	sriTag: undefined,
	extension: undefined
};

/**
 * Initializes the `sriSet` object by setting all its properties to `undefined`.
 * This method iterates over each property of the `sriSet` object and resets its value.
 *
 * @return {void} Does not return a value.
 */
function initSriSet() {
	for(const key in sriSet){
		sriSet[key] = undefined;
	}
}

/**
 * Extracts and returns the file extension from the given target.
 *  - If the target is a URL object, it retrieves the pathname from the URL.
 *  - If the target is a string, it processes the string directly.
 *
 * The extracted extension is converted to lowercase.
 *
 * @param {URL|string} target - The target object or string to extract the file extension from. It can be a URL object or a string representing a file path.
 * @return {string} The extracted file extension in lowercase. Returns an empty string if no extension is found.
 */
function getExtension(target) {
	const name = (target instanceof URL) ? target.pathname : target;

	return name.split('.').pop().toLowerCase();
}

/**
 * Validates a given URL to ensure it has a proper protocol and allowed extension.
 *
 * @param {string} u - The URL to validate.
 * @return {boolean} Returns true if the URL is valid and meets the specified conditions; otherwise, false.
 */
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

			sriSet.extension = ext;
		}

		return true;
	} catch(e){
		console.error(e);

		return false;
	}
}

/**
 * Fetches the content from the provided URL and returns it as an ArrayBuffer.
 *
 * @param {string} url The URL to fetch content from.
 * @return {Promise<ArrayBuffer>} A promise that resolves to the content in ArrayBuffer format.
 * @throws {Error} If the fetch operation fails or the response is not successful.
 */
async function fetchContent(url) {
	const response = await fetch(url);

	if(!response.ok){
		throw new Error(`Fetch failed: ${response.status} - ${response.statusText}`);
	}

	return await response.arrayBuffer();
}

/**
 * Probes the given URL for CORS (Cross-Origin Resource Sharing) accessibility and readability.
 * It attempts to send HEAD and GET requests with CORS mode, and checks the response status,
 * content type, and other details to determine if the resource is readable.
 *
 * @param {string} url - The URL to be probed for CORS readability.
 * @return {Promise<Object>} A promise that resolves to an object containing:
 * - `readable` (boolean): Whether the URL is accessible and readable.
 * - `status` (number): The HTTP status code of the response (only when successful).
 * - `contentType` (string): The content type of the response (only when successful).
 * - `reason` (string): The error message in case the URL is not readable (only when unsuccessful).
 * - `error` (Error): The error object in case the URL is not readable (only when unsuccessful).
 */
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
	} catch(e){
		return { readable: false, reason: e.message, error: e };
	}
}

/**
 * Validates the given file to ensure it meets certain criteria.
 *
 * @param {Object} file - The file object to be validated.
 * @param {string} file.name - The name of the file to extract the extension.
 * @return {boolean} Returns true if the file is valid, otherwise false.
 */
function validateFile(file) {
	if(!file || !file.name){
		return false;
	}

	const ext = getExtension(file.name);
	if(!ALLOWED_EXTENSIONS.includes(ext)){
		return false;
	}

	sriSet.extension = ext;

	return true;
}

/**
 * Converts a given hashing algorithm to its corresponding Subresource Integrity (SRI) prefix.
 *
 * @param {string} algo - The hashing algorithm name (e.g., 'SHA-256', 'SHA-384', 'SHA-512') to be converted.
 * @return {string} The SRI prefix in the format 'shaXXX-' where XXX represents the bit length of the algorithm.
 */
function algoToSriPrefix(algo) {
	const algoBit = algo.replace(/^SHA\-(256|384|512)$/i, '$1');

	return `sha${algoBit}-`;
}

/**
 * Converts an ArrayBuffer into a Base64-encoded string.
 *
 * @param {ArrayBuffer} buf - The ArrayBuffer to convert.
 * @return {string} The Base64-encoded representation of the input ArrayBuffer.
 */
function arrayBufferToBase64(buf) {
	const bytes = new Uint8Array(buf);
	const chunk = 0x8000;

	let bin = '';
	for(let i = 0; i < bytes.length; i += chunk){
		bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}

	return btoa(bin);
}

/**
 * Generates a Subresource Integrity (SRI) string from an ArrayBuffer using the specified hashing algorithm.
 *
 * @param {ArrayBuffer} arrayBuffer - The input ArrayBuffer to generate the SRI string from.
 * @param {string} algo - The hashing algorithm to use (e.g., "SHA-256", "SHA-384", "SHA-512").
 * @return {Promise<string>} A promise that resolves to the generated SRI string.
 */
async function sriFromArrayBuffer(arrayBuffer, algo) {
	const digest = await crypto.subtle.digest(algo, arrayBuffer);
	const base64 = arrayBufferToBase64(digest);

	return algoToSriPrefix(algo) + base64;
}

/**
 * Generates an HTML tag string based on the provided source, SRI (Subresource Integrity) hash, and file extension.
 *
 * @param {string} source - The URL or path of the resource being referenced in the HTML tag.
 * @param {string} sri - The Subresource Integrity hash for the resource to ensure secure loading.
 * @return {string} The appropriately constructed HTML tag string for the given file type or an error if the extension is unknown.
 * @throws {Error} Throws an error if the file extension is not supported.
 */
function makeHtmlTag(source, sri) {
	switch(sriSet.extension){
		case 'js':
			return `<script src="${source}" integrity="${sri}" crossorigin="anonymous"></script>`;
		case 'wasm':
			return `<script type="module" src="${source}" integrity="${sri}" crossorigin="anonymous"></script>`;
		case 'css':
			return `<link rel="stylesheet" href="${source}" integrity="${sri}" crossorigin="anonymous">`;
		default:
			throw new Error(`Unknown extension: ${sriSet.extension}`);
	}
}

/**
 * Copies the provided text to the system clipboard. Uses the Clipboard API when available
 * and falls back to a manual method for environments without secure context capabilities.
 *
 * @param {string} text - The text string to be copied to the clipboard.
 * @return {Promise<void>} A promise that resolves when the text has been successfully copied to the clipboard.
 */
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

	$('input[name="upload-file"]').attr('accept', ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(','));
	$('p.allow-ext > span.ext').html(`<span class="mono-font">${ALLOWED_EXTENSIONS.join(',')}</span>`);

	const showAlert = (msg) => {
		$errorAlert.text(msg);
		$errorAlert.show();
	};
	const hideAlert = () => {
		$errorAlert.hide();
		$errorAlert.empty();
	};

	/*
	 * タブ切り替えによるモード変更
	 */
	let mode = 'fetch';
	$('#selectMode button').click(function(){
		const $this = $(this);

		if($(this).hasClass('active')){
			const id = $this.attr('id');
			const activeMode = id.replace(/^mode-(.+)-tab$/, '$1');
			if(mode !== activeMode){
				mode = activeMode;
			}
		}
	});

	/*
	 * ハッシュ化ボタン押下
	 */
	$('button[name="generate-hash"]').click(async () => {
		// 結果オブジェクトの初期化
		initSriSet();

		// 結果コンテンツの隠蔽
		hideAlert();
		$resultCard.hide();

		const url     = $urlForm.val().trim();
		const file    = $uploadForm.files[0] ?? null;
		const sriHash = $('select[name="sri-hash"] option:selected').val();

		let errMsg;

		if(mode === 'fetch'){
			if(!validateURL(url)){
				errMsg = 'Invalid URL or invalid file type';
			} else{
				// フェッチとCORSチェック
				const proveRes = await probeCorsReadable(url);
				if(!proveRes.readable){
					errMsg = 'May not be found or violates CORS policy. Please check URL or download the file and try uploading it.';

					$('button#mode-upload-tab').click();
				}
			}
		}
		else if(mode === 'upload'){
			if(!file || file.size === 0){
				errMsg = 'Upload file is required';
			} else if(!validateFile(file)){
				errMsg = 'Invalid upload file type';
			}
		}
		// 不正
		else{
			showAlert('URL or file is required');

			return false;
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

			sriSet.sri = await sriFromArrayBuffer(resBuffer, sriHash);
			sriSet.sriTag = makeHtmlTag(src, sriSet.sri);

			$('#sri > pre').text(sriSet.sri);
			$('#sri-tag > pre').text(sriSet.sriTag);

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
			text = sriSet.sri;
		} else if(attribute === 'sri-tag'){
			text = sriSet.sriTag;
		} else{
			throw new Error(`Invalid attribute: ${attribute}`);
		}

		copyToClipboard(text)
			.then(() => {
				const btnLabelHtml = $this.html();
				const $iFind = () => $this.find('i');

				$this.prop('disabled', true);
				$this.html('<i class="bi bi-check2"></i> Copied!');
				$iFind().addClass('btn-fade');

				// 1秒後にフェードアウト開始
				setTimeout(() => {
					$iFind().addClass('fade-out');
				}, enableDuration - 300); // 残り0.3秒でフェード開始

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