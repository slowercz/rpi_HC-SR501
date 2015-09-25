var request = require('request');


var PASSWORD = 'motSens';
var USERNAME = 'motion-sensor';
var CLIENTID = 'iot';
var IP = "https://localhost:8443";

var Communication = function(){
  var token = null;
  var refreshTokenHash = null;
  var motion = 1;
  var interval = null;
  
  this.startCommunication = function(){
    getToken(startPolling);
  };
  
  var getToken = function(successCallback){
    request.post({
    url: IP+"/auth/realms/iot/protocol/openid-connect/token",
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
    url: IP+"/auth/realms/iot/protocol/openid-connect/token",
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
    interval = setInterval(function(){readMovement(token);},1000);
  };
  
  var stopPolling = function(){
    clearInterval(interval);
  };
  
  var readMovement = function(token){
    var change = Math.random();
    if(change>0.8){
      if(motion == 1){
	motion = 0;
	sendMotion(token, "Sensor 1: movement started");
      }else{
	motion = 1;
	sendMotion(token, "Sensor 1: movement stopped");
      }
    }
  };
  
  var sendMotion = function(token,value){
    request.post({
      url: IP +"/iot-hub-example/rest/movement/add/" + value,
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
