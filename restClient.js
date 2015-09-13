var request = require('request');
var Gpio = require('onoff').Gpio;
// Configure GPIO pin 21 for input and rising edge detection
var pir = new Gpio(21,'in','rising');

var PASSWORD = 'motSens';
var USERNAME = 'motion-sensor';
var CLIENTID = 'iot';
var IP = "147.32.83.195:8443";

var Communication = function(){
  var token = null;
  var refreshTokenHash = null;
  var motion = 0;
  var interval = null;
  var lastMovement = 0;
  
  this.startCommunication = function(){
    getToken(startPolling);
  };
  
  var getToken = function(successCallback){
    request.post({
    url: "https://"+IP+"/auth/realms/iot/protocol/openid-connect/token",
    form: {username:USERNAME,password:PASSWORD,client_id:CLIENTID,grant_type:'password'},
    rejectUnauthorized : false},
    function(err,httpResponse,body){
      if(err !== null){
        console.log("An error occured, error message:");
        console.log(err);
      }else{
	var parsed = JSON.parse(body);
        token = parsed.access_token;
	refreshTokenHash = parsed.refresh_token;
	successCallback();
      }
    });
  };
  
  var refreshToken = function(successCallback){
    request.post({
    url: "https://"+IP+"/auth/realms/iot/protocol/openid-connect/token",
    form: {refresh_token:refreshTokenHash,client_id:CLIENTID,grant_type:'refresh_token'},
    rejectUnauthorized : false},
    function(err,httpResponse,body){
      if(err !== null){
        console.log("An error occured at refreshing token, error message:");
        console.log(err);
	console.log("Trying to obtain new access token");
	getToken(successCallback);
      }else{
	var parsed = JSON.parse(body);
        token = parsed.access_token;
	refreshTokenHash = parsed.refresh_token;
	successCallback();
      }
    });
  };
  
  /**
   * Need to start two function - pir.watch monitors high edge of sensor (movement), readMovement determines when movement started and ended.
   */
  var startPolling = function(){
    pir.watch(function(err,value){
      var date = new Date();
      lastMovement = date.getTime();
    });
    interval = setInterval(function(){readMovement(token);},1000);
  };
  
  var stopPolling = function(){
    pir.unwatch();
    clearInterval(interval);
  };
  
  var readMovement = function(token){
    //if lastMovement is zero, then nothing has moved so far and we don't have to check anything
    if(lastMovement != 0){
      //movement just started, pretty straightforward
      if(motion==0){
	sendMotion(token, "Sensor 1: movement started");
	motion = 1; // set movement started variable
      //there is movement going on right now, we need to determine when last movement occured, to know if it has not stopped already
      }else{
	var date = new Date();
	var movementBefore = date.getTime() - lastMovement;
	// compare current time with time of last movement, if the last movement is older then given time (10s) we consider movement to be stopped
	if(movementBefore > 10000){
	  sendMotion(token, "Sensor 1: movement stopped");
	  lastMovement = 0; //delete last movement, so the function does not enter first condition
	  motion = 0;
	}
      }
    }
  };
  
  var sendMotion = function(token,value){
    request.post({
      url:"https://"+ IP +"/iot-hub-example/rest/movement/add/" + value,
	headers: { 'Authorization': 'Bearer '+token},
	rejectUnauthorized : false},
	function(err,httpResponse,body){
	  if(err !== null || httpResponse.statusCode !== 201){
	    console.log("Temperature sending failed, retrying");
	    console.log("HTTP Response: "+httpResponse.statusCode);
	    stopPolling();
	    refreshToken(startPolling);
	  }else{
	    console.log(value);
	  }
	}
    );
  };
};

var com = new Communication();
com.startCommunication();
