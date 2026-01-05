const ALLOWED_EXTENSIONS = ['js', 'css', 'wasm'];

let extension;

function getExtension(url) {
	return url.pathname.split('.').pop();
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

function algoToSriPrefix(algo) {
	// WebCrypto: "SHA-384" -> SRI: "sha384-"
	return "sha" + algo.split("-")[1] + "-";
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

$(() => {
	const $errorAlert = $('#error-alert');
	const $resultCard = $('#result');
	const $urlForm = $('input[name="url"]');

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

		hideAlert();
		$resultCard.hide();

		const url = $urlForm.val();
		let errMsg;
		if(!url){
			errMsg = 'URL is required';
		} else if(!validateURL(url)){
			errMsg = 'Invalid URL';
		}

		if(errMsg){
			showAlert(errMsg);

			return false;
		}

		try {
			const resBuffer = await fetchContent(url);

			const sri = await sriFromArrayBuffer(resBuffer, $('select[name="sri-hash"] option:selected').val());

			$('#sri > pre').text(sri);
			$('#sri-tag > pre').text(makeHtmlTag(url, sri));

			$resultCard.show();
		} catch(e){
			console.error(e);

			showAlert(e.message);
		}
	});
})