/**
 * Updates the visibility of the offline notice based on the network status.
 * If the device is online, it hides the offline notice. Otherwise, it shows the offline notice.
 *
 * @return {void} This function does not return anything.
 */
function updateNetworkStatus(){

	const notice = document.getElementById('offline-notice');

	if(notice){
		if(navigator.onLine){
			if(!notice.classList.contains('d-none')){
				notice.classList.add('d-none');
			}
		} else{
			notice.classList.remove('d-none');
		}
	} else{
		console.error('Offline notice element not found');
	}
}

/**
 * Initializes and manages the network status updates by setting up event listeners for
 * online and offline events.
 */
window.addEventListener('load', () => {
	updateNetworkStatus();
	window.addEventListener('online', updateNetworkStatus);
	window.addEventListener('offline', updateNetworkStatus);
});

/**
 * Registration in Service Worker
 */
if('serviceWorker' in navigator){
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('./service-worker.js')
			.then(() => {
				console.log('Service Worker registered successfully');
			})
			.catch((err) => {
				console.error('Service Worker registration failed:', err);
			});
	});
}
