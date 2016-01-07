// This script will connect to the Connection Machine or the Connection Machine Emulator.
// It will use the LEDs to display Simon Says inputs depending on the game state on the phone.
// Connection and communication is done according to the protocol specification
// linked on http://www.teco.edu/cm/dev/:
// http://www.teco.edu/wp-content/uploads/2014/10/teco_led_matrix_protocol.pdf


// The MAC address of the device. Gets filled in from the list of bonded devices.
var macAddress;

// Indicates whether the Connection Machine is connected or not. (To reduce function calls in offline mode.)
var connected = false;

// The two-dimensional matrix representing the LED panels
var xy = [];

// Indicates whether the buttons are active and clickable or a sequence is played automatically at the moment. (Default: false)
var autoplay = false;

// Indicates whether a game is active at the moment.
var game = false;

// The current sequence
var sequence = [];

// The current position in the sequence.
var currentPosition = 0;

// Timer used to clear buttons after clicks.
var timer;

// Start listening for the deviceready-Event.
function initialize() {
	document.addEventListener('deviceready', onDeviceReady, false);
}

// Event received. We may now use PhoneGap APIs.
function onDeviceReady() {
	var parentElement = document.getElementById('status');
	var listeningElement = parentElement.querySelector('.listening');
	var receivedElement = parentElement.querySelector('.received');
	var waitingElement = parentElement.querySelector('.waiting');
	var searchingElement = parentElement.querySelector('.searching');
	listeningElement.setAttribute('style', 'display:none;');
	receivedElement.setAttribute('style', 'display:block;');
	waitingElement.setAttribute('style', 'display:none;');
	searchingElement.setAttribute('style', 'display:block;');
	
	// Create 24x24 matrix. We can fill this matrix with values between 0 and 255 to
	// represent the brightness of the LED.
	var rows = 24;
	for (var i  = 0; i < rows; i++){
		 xy[i] = [];
		 for (var j = 0; j < rows; j++){
			xy[i][j] = 0;
		 }
	}

	// Check bonded devices. (Note: This does not start a BT scan, it only lists the bonded devices.)
	bluetoothSerial.list(listSuccess, listFailure);
	
	console.log('Received Events: ' + 'deviceready');
}

// Gets called when list of bonded devices was received.
function listSuccess(pairedDevices) {	

	// Loop through devices and loop for device with name "ledpi-teco".
	for(var i = 0; i < pairedDevices.length ; i++){
		var item = pairedDevices[i];
		console.log('Bonded device: ' + item.name);
		if(item.name === "ledpi-teco"){
			macAddress = item.id;
			connectLedPi();
			return;
		} 
	}
	
	//No device found
	console.log('No device named ledpi-teco found.');
	
	// set status message
	var parentElement = document.getElementById('status');
	var searchingElement = parentElement.querySelector('.searching');
	var noPiElement = parentElement.querySelector('.noPi');
	searchingElement.setAttribute('style', 'display:none;');
	noPiElement.setAttribute('style', 'display:block;');
}

// Try to connect to ledpi-teco device.
function connectLedPi() {

console.log('Found device with name ledpi-teco: MAC address is ' + macAddress);
	
	// Connect to device.
	console.log('Connecting to ' + macAddress);
	bluetoothSerial.connect(macAddress, connectSuccess, connectFailure);
}

// Called when listing of bonded devices fails.
function listFailure() {	
	console.log('Listing bonded devices failed.');
	var parentElement = document.getElementById('status');
	var searchingElement = parentElement.querySelector('.searching');
	var noPiElement = parentElement.querySelector('.noList');
	searchingElement.setAttribute('style', 'display:none;');
	noListElement.setAttribute('style', 'display:block;');
}

// Called when connection to device is established.
function connectSuccess() {
	console.log('Connected to ' + macAddress);
	
	var parentElement = document.getElementById('status');
	var searchingElement = parentElement.querySelector('.searching');
	var connectingElement = parentElement.querySelector('.connecting');
	searchingElement.setAttribute('style', 'display:none;');
	connectingElement.setAttribute('style', 'display:block;');
	
	// Write handshake.
	handshake();
}

// Called when connection to device has failed.
function connectFailure() {
	console.log('Received Events: ' + 'connectFailure');
	var parentElement = document.getElementById('status');
	var connectingElement = parentElement.querySelector('.connecting');
	var noConnectionElement = parentElement.querySelector('.noConnection');
	connectingElement.setAttribute('style', 'display:none;');
	noConnectionElement.setAttribute('style', 'display:block;');
}

// This function will try to initiate the handshake as described in
// http://www.teco.edu/wp-content/uploads/2014/10/teco_led_matrix_protocol.pdf
function handshake() {
	var version = 1;
	var xSize = 24;
	var ySize = 24;
	var colorMode = 0;
	var appName = "Connection Machine Says App";
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
	var parentElement = document.getElementById('status');
	var connectingElement = parentElement.querySelector('.connecting');
	var noConnectionElement = parentElement.querySelector('.noConnection');
	connectingElement.setAttribute('style', 'display:none;');
	noConnectionElement.setAttribute('style', 'display:block;');
}

// Called when bluetooth send (handshake) was successful.
function sendHandshakeSuccess() {
	// Wait 1-2 seconds for handshake response, then read it.
	setTimeout(function() { bluetoothSerial.read(handshakeReadSuccess, handshakeReadFailure)}, 2000);
}

// Called when reading of handshake response fails.
function handshakeReadFailure() {
	console.log("Handshake read failed");
	var parentElement = document.getElementById('status');
	var connectingElement = parentElement.querySelector('.connecting');
	var noConnectionElement = parentElement.querySelector('.noConnection');
	connectingElement.setAttribute('style', 'display:none;');
	noConnectionElement.setAttribute('style', 'display:block;');
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
	
	// Set status message
	var parentElement = document.getElementById('status');
	var connectingElement = parentElement.querySelector('.connecting');
	var readyElement = parentElement.querySelector('.ready');
	connectingElement.setAttribute('style', 'display:none;');
	readyElement.setAttribute('style', 'display:block;');
	
	connected = true;
}

// Send one frame to CM.
function writeData() {	

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

// Register button presses.
function registerClick(button) {
	if (autoplay){
		return;
	}
	clearTimeout(timer);
	updateMatrix(button);
	updateButtons(button);
	timer = setTimeout(clearScreen, 400);
	if (game) {
		if (button == sequence[currentPosition]){
			correctButton();
		} else {
			loseGame();
		}
	}
}

//Lights panels and buttons according to the current sequence.
function playSequence() {
	if (autoplay) {
		return;
	}
	autoplay = true;
	var current = 0;
	setButtonActive(false);
	var autoplayer = setInterval(autoLight, 500);
	function autoLight() {
		if(current == sequence.length) {
			clearInterval(autoplayer);
			setButtonActive(true);
			autoplay = false;
		} else {
			updateMatrix(sequence[current]);
			updateButtons(sequence[current]);
			current++;
			setTimeout(clearScreen, 400);
		}
	}
}

function clearScreen() {
	updateMatrix(-1);
	updateButtons(-1);
}

//Sets button state. true = active, false = disabled
function setButtonActive(isActive) {
	var buttons = document.getElementsByClassName("gameButton");
	for (var i = 0; i < buttons.length; i++) {
		buttons[i].disabled = !isActive;
	}
}

// Changes the lit buttons.
function updateButtons(button) {
	var buttons = document.getElementsByClassName("gameButton");
	for (var i = 0; i < 4; i++) {
		if (button == 0 || button == i+1) {
			buttons[i].style.backgroundColor = "darkred";
		} else {
			buttons[i].removeAttribute('style');
		}
	}
}

// Updates the LED screens. 1 to 4 set the corresponding panel, -1 turns all panels off, everything else sets all panels.
function updateMatrix(panel){

	if (!connected) {
		return;
	}
	
	var xStart = 0;
	var xStop = 24;
	var yStart = 0;
	var yStop = 24;
	if (panel == 1) {
		xStop = 12;
		yStop = 12;
	} else if (panel == 2) {
		xStop = 12;
		yStart = 12;
		yStop = 24;
	} else if (panel == 3) {
		xStart = 12;
		xStop = 24;
		yStop = 12
	} else if (panel == 4) {
		xStart = 12;
		xStop = 24;
		yStart = 12;
		yStop = 24;
	} else if (panel == -1) {
		xStart = 24;
		xStop = 24;
		yStart = 24;
		yStop = 24;
	}
	
	for (var i  = 0; i < 24; i++){
		 for (var j = 0; j < 24; j++){
			if(i >= xStart && i < xStop && j >= yStart && j < yStop) {
				xy[i][j] = 255;
			} else {
				xy[i][j] = 0;
			}
		 }
	}
}

// Starts a new game.
function startGame() {
	if (game) {
		return;
	}
	game = true;
	clearScreen();
	sequence = [];
	increaseSequence();
	currentPosition = 0;
	playSequence();
}

// Makes the sequence longer.
function increaseSequence() {
	sequence.push(Math.floor((Math.random() * 4) + 1));
}

function correctButton() {
	currentPosition++;
	if (currentPosition == sequence.length) {
		setButtonActive(false);
		increaseSequence();
		currentPosition = 0;
		setTimeout(playSequence, 500);
	}
}

function loseGame() {
	setButtonActive(false);
	game = false;
	sequence = [0,0,0,0];
	setTimeout(playSequence, 300);
}
