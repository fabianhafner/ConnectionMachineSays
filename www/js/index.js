// This script will connect to the Connection Machine or the Connection Machine Emulator.
// It will show a 3x3 dot on the LEDs depending on the accelerometer values of the phone.
// Connection and communication is done according to the protocol specification
// linked on http://www.teco.edu/cm/dev/:
// http://www.teco.edu/wp-content/uploads/2014/10/teco_led_matrix_protocol.pdf


// The MAC address of the device. Gets filled in from the list of bonded devices.
var macAddress;

// Coordinate of currently activated LED.
var xLed;
var yLed;

// Start listening for the deviceready-Event.
function initialize() {
	document.addEventListener('deviceready', onDeviceReady, false);
}

// Event received. We may now use PhoneGap APIs.
function onDeviceReady() {
	var parentElement = document.getElementById('someContent');
	var listeningElement = parentElement.querySelector('.listening');
	var receivedElement = parentElement.querySelector('.received');
	listeningElement.setAttribute('style', 'display:none;');
	receivedElement.setAttribute('style', 'display:block;');
	
	// Register for accelerometer events.
	registerAccelerometer();

	// Check bonded devices. (Note: This does not start a BT scan, it only lists the bonded devices.)
	bluetoothSerial.list(listSuccess, listFailure);
	
	console.log('Received Events: ' + 'deviceready');
}

// Get current device orientation and map it to X and Y LED range of CM (0-24).
function registerAccelerometer() {
	window.ondevicemotion = function(event) { 
		ax = event.accelerationIncludingGravity.x;
		ay = event.accelerationIncludingGravity.y;
		az = event.accelerationIncludingGravity.z;
		
		// Linear map values (-8/+8 to 0/23).
		var horizontal = 0 + ((23 - 0) / (8 - (-8))) * (ay - (-8));
		var vertical = 0 + ((23 - 0) / (8 - (-8))) * (ax - (-8));
		
		if (horizontal <= 0) {
			xLed = 0;
		} else if (horizontal >= 23) {
			xLed = 23;
		} else {
			xLed = Math.round(horizontal);
		}
		
		// Make sure we have an integer between 0 and 23.
		if (vertical <= 0) {
			yLed = 0;
		} else if (vertical >= 23) {
			yLed = 23;
		} else {
			yLed = Math.round(vertical);
		}
	}
}

// Gets called when list of bonded devices was received.
function listSuccess(pairedDevices) {	

	// Loop through devices and loop for device with name "ledpi-teco".
	// This has no error handling! When the devices are not paired, it won't work!
	for(var i = 0; i < pairedDevices.length ; i++){
		var item = pairedDevices[i];
		if(item.name === "ledpi-teco"){
			macAddress = item.id;
		} 
		console.log('Bonded device: ' + item.name);
	}
	
	console.log('Found device with name ledpi-teco: MAC address is ' + macAddress);
	
	// Connect to device.
	console.log('Connecting to ' + macAddress);
	bluetoothSerial.connect(macAddress, connectSuccess, connectFailure);
}

// Called when listing of bonded devices fails.
function listFailure() {	
	console.log('Listing bonded devices failed.');
}

// Called when connection to device is established.
function connectSuccess() {
	console.log('Connected to ' + macAddress);
	
	// Write handshake.
	handshake();
}

// Called when connection to device has failed.
function connectFailure() {
	console.log('Received Events: ' + 'connectFailure');
}

// This function will try to initiate the handshake as described in
// http://www.teco.edu/wp-content/uploads/2014/10/teco_led_matrix_protocol.pdf
function handshake() {
	var version = 1;
	var xSize = 24;
	var ySize = 24;
	var colorMode = 0;
	var appName = "PhoneGap BT Example App";
	var nameLength = appName.length;
	var packetSize = 5 + nameLength;
	
	var buffer = new ArrayBuffer(packetSize);
	var matrix = new Uint8Array(buffer);

	// Fill send buffer with version, size, color mode and name length.
	matrix[0] = version;
	matrix[1] = xSize;
	matrix[2] = ySize;
	matrix[3] = colorMode;
	matrix[4] = nameLength;
	
	// Add name to send buffer.
	for (var i = 0; i < nameLength; i++) {
		matrix[i + 5] = appName.charCodeAt(i);
	}
	
	// Send and initiate handshake.
	console.log("Sending: " + matrix);
	bluetoothSerial.write(matrix.buffer, sendHandshakeSuccess, sendHandshakeFailure);
}

// Called when bluetooth send (handshake) fails.
function sendHandshakeFailure() {
	console.log("Handshake write failed");
}

// Called when bluetooth send (handshake) was successful.
function sendHandshakeSuccess() {
	// Wait 1-2 seconds for handshake response, then read it.
	setTimeout(function() { bluetoothSerial.read(handshakeReadSuccess, handshakeReadFailure)}, 2000);
}

// Called when reading of handshake response fails.
function handshakeReadFailure() {
	console.log("Handshake read failed");
}

// Called when reading of handshake response was successful.
function handshakeReadSuccess(resp) {
	// Read handshake response (2 bytes).
	var responseCode = resp.charCodeAt(0);
	var maxFPS = resp.charCodeAt(1);
	
	// Start sending frames to the connection machine with the allowed max FPS.
	console.log("Handshake response: " + responseCode + " " + maxFPS);
	if (responseCode == 0) {
		var timer = setInterval(function() { writeData() }, 1000 / maxFPS);
	}
}

// Send one frame to CM.
function writeData() {	

	// Create 24x24 matrix. We can fill this matrix with values between 0 and 255 to
	// represent the brightness of the LED.
	var xy = [];
	var rows = 24;
	for (var i  = 0; i < rows; i++){
		 xy[i] = [];
	}
	
	for (var i = 0; i < 24; i++) {
		for (var j = 0; j < 24; j++) {
			if ((i == yLed || i+1 == yLed || i-1 == yLed) && 
				(j == xLed || j+1 == xLed || j-1 == xLed)) {
				xy[i][j] = 255;
			} else {
				xy[i][j] = 0;
			}
		}	
	}

	// Make matrix into something the Connection Machine understands and send data.
	var buffer = new ArrayBuffer(576);
	var matrix = new Uint8Array(buffer);
	
	for (var i = 0; i < 24; i++) {
		for (var j = 0; j <24; j++) {
			matrix[i * 24 + j] = xy[i][j];
		}	
	}
	
	bluetoothSerial.write(matrix.buffer, sendSuccess, sendFailure);
} 

// Called when sending of frame to CM was successful.
function sendSuccess() {
	console.log('Received Events: ' + 'sendSuccess');
}

// Called when sending of frame to CM fails.
function sendFailure() {
	console.log('Received Events: ' + 'sendFailure');
}



