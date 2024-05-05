var userProperties = PropertiesService.getUserProperties();
var scriptProperties = PropertiesService.getScriptProperties();
var schwab_apikey = scriptProperties.getProperty('schwab_apikey')
var schwab_secret = scriptProperties.getProperty('schwab_secret')
var encodedCredentials = Utilities.base64Encode(schwab_apikey + ":" + schwab_secret);

// On Spreadsheet open, add a menu for Schwab API
function onOpen(e) {
  var refresh_time_expiry = userProperties.getProperty("refresh_time_expiry");
  var mynow = new Date();
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Schwab API')
    .addItem('Authenticate', 'schwab_ShowPane')
    .addSeparator()
    .addItem("Authentication expires: " + refresh_time_expiry, 'null')
    .addToUi();


    if ( Date.parse(mynow) > Date.parse(refresh_time_expiry) ) {
    Logger.log("Schwab Authentication has expired, user needs to reauth.")
  }
}

function showDialog() {
  var html = HtmlService.createHtmlOutputFromFile('schwab_SidePane')
    .setWidth(400)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dialog Title');
}

//Open a SidePane asynchronously. The html will return by calling the function schwab_backfromPane
function schwab_ShowPane() {
  linkURL = "https://api.schwabapi.com/v1/oauth/authorize?client_id="+ schwab_apikey +"&redirect_uri=https%3A%2F%2F127.0.0.1";
  var html = HtmlService.createTemplateFromFile('schwab_SidePane')
    .evaluate();
  SpreadsheetApp.getUi().showSidebar(html);
}

// Call this function to open the sidebar
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('schwab_SidePane.html')
    .setTitle('Schwab API Auth')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function schwab_backfromPane(d) {
// Called after user clicks Step 2 button on SidePane, return here with dictionary d
  
  schwab_GetTokens(d.returnURI);
  
}

//******************************MAIN FUNCTIONS***************************************************

/**
 * Call Ameritrade API to get the price of stockSymbol.
 *
 * @param {"GOOG"} stockSymbol the stock's ticker symbol
 * @param {"lastPrice"} priceType the price field to use. Valid examples are [ "lastPrice" | "openPrice" | "highPrice" | "lowPrice" | "closePrice" | "regularMarketLastPrice" ]
 * @customfunction
 */

function schwab_GetQuote(stockSymbol,priceType) {
  // Check if stockSymbol is empty
  if (stockSymbol === "" || stockSymbol === null || typeof stockSymbol === "undefined") {
    return "Stock symbol is empty";
  }

  // Check if priceType is empty
  if (priceType === "" || priceType === null || typeof priceType === "undefined") {
    return "Price type is empty";
  }
  
  var authorization = schwab_GetBearerString();
  var options = {
    "method" : "GET",
    "headers" :  {"Authorization" : authorization},
  };
  var myurl="https://api.schwabapi.com/marketdata/v1/quotes?symbols=" + stockSymbol;
  var result=UrlFetchApp.fetch(myurl, options);
  
  var contents = result.getContentText();
  var json = JSON.parse(contents);
  
  var price = json[stockSymbol]["quote"][priceType];
  Logger.log(stockSymbol + ": " + price);
  
  return price;
}


/**
 * Returns a balance value of your Schwab account.
 *
 * @param {"equity"} balance the balance to obtain. Valid examples are [ "cashBalance" | "liquidationValue" | "longMarketValue" | "availableFunds" | "buyingPower" | "equity" | "longMarginValue" | "maintenanceRequirement" | "marginBalance" ]. Additional examples can be found in the API documentation.
 * @customfunction
 */
function schwab_Balance(balance) {
  var authorization = schwab_GetBearerString();
  var options = {
    "method" : "GET",
    "headers" :  {"Authorization" : authorization},
  };
  var myUrl =
    "https://api.schwabapi.com/trader/v1/accounts";
  var result = UrlFetchApp.fetch(myUrl, options);

  var contents = result.getContentText();
  var json = JSON.parse(contents);
  var value = json[0]["securitiesAccount"]["currentBalances"][balance];
  Logger.log(value)

  return value;
}


/**
 * Returns the positions in your Schwab portfolio with the following fields in an array: [ Stock Symbol | Quantity | Average Price | Market Value | Current Day P/L | Current Day P/L % ]
 *
 * @customfunction
 */
function schwab_Positions() {
  var authorization = schwab_GetBearerString();
  var options = {
    "method" : "GET",
    "headers" :  {"Authorization" : authorization},
  };
  var extraOptions = "?fields=positions";

  var myUrl =
    "https://api.schwabapi.com/trader/v1/accounts/" +  extraOptions;
  var result = UrlFetchApp.fetch(myUrl, options);

  //Parse JSON
  var contents = result.getContentText();
  var json = JSON.parse(contents);
  var positions = json[0]["securitiesAccount"]["positions"];

  var attributes = [
    "instrument", // The stock symbol is inside this returned "instrument" object.
    "longQuantity",
    "averagePrice",
    "marketValue",
    "currentDayProfitLoss",
    "currentDayProfitLossPercentage"
  ];

  var array = [];
  var item = [];

  for (var stocki = 0; stocki < positions.length; stocki++) {
    // Iterate over all returned positions
    for (var attributei = 0; attributei < attributes.length; attributei++) {
      // Iterate over the wanted attributes to find the corresponding value in the returned positions
      if (attributes[attributei] === "instrument") {
        item.push(positions[stocki][attributes[attributei]]["symbol"]);
      } else {
        item.push(positions[stocki][attributes[attributei]]);
      }
    }
    array.push(item);
    item = [];
  }

  array.sort(function(b, a) {
    // Sorted by currentDayProfitLossPercentage
    return a[5] - b[5];
  });

   Logger.log(array)

  return array;
}


//*****************************AUTHENTICATION FUNCTIONS****************************************************************

function schwab_GetBearerString(){
// Call schwab get access token using the refresh token - check validity of both access and refresh tokens.
// Access token lasts for 30 minutes, refresh token lasts for 7 days before having to require user to authenticate again
// curl -X POST --header "Content-Type: application/x-www-form-urlencoded" -d "grant_type=refresh_token&refresh_token=<refresh_token>&redirect_uri=https%3A%2F%2F127.0.0.1" "https://api.schwabapi.com/v1/oauth2/token"

  var refresh_token = userProperties.getProperty("refresh_token");
  var refresh_time_expiry = userProperties.getProperty("refresh_time_expiry");
  var access_token = userProperties.getProperty("access_token");
  var access_time_expiry = userProperties.getProperty("access_time_expiry");
  var mynow = new Date();

//  if ( (Date.parse(mynow) - Date.parse(access_time)) <29*60*1000 ) { //Access token is still not expired
//    Logger.log(1800 - (Date.parse(mynow) - Date.parse(access_time))/1000 + " seconds until access token expires, using existing token.")
//    return "Bearer " + access_token; 
//  } else if ( (Date.parse(mynow) - Date.parse(refresh_time)) >7*24*60*60*1000 ) {  //Refresh token expired
//    //re-authenticate - schwab_showPane() ?
//    Logger.log("Refresh Token has expired. Reauthentication is probably needed, but trying to proceed with renewing the Access Token")
//    // return "Re-authentication needed!";    
//  }

  if ( Date.parse(mynow) < Date.parse(access_time_expiry) ) {
 //   Logger.log(( (Date.parse(access_time_expiry) - Date.parse(mynow)) / 1000) + " seconds until access token expires, using existing access token")
    return "Bearer " + access_token;
  }

 Logger.log("Access Token expired " + ((Date.parse(access_time_expiry) - Date.parse(mynow))/1000) + " seconds ago. Generating a new one.")

// refresh access_token with refresh token
// curl -X POST \https://api.schwabapi.com/v1/oauth/token \-H 'Authorization: Basic {BASE64_ENCODED_Client_ID:Client_Secret} \-H 'Content-Type: application/x-www-form-urlencoded' \-d 'grant_type=refresh_token&refresh_token={REFRESH_TOKEN_GENERATED_FROM_PRIOR_STEP}

  var formData = {
    "grant_type" : "refresh_token",
    "refresh_token" : refresh_token,
  }
  var options = {
    "method" : "post",
    "headers": {
    "Authorization": "Basic " + encodedCredentials
    },
    "payload" : formData
  }
  var myurl="https://api.schwabapi.com/v1/oauth/token";
  var result=UrlFetchApp.fetch(myurl, options);

  //Parse JSON
  var contents = result.getContentText();
  var json = JSON.parse(contents);
//  Logger.log("JSON string: " + JSON.stringify(json))
  
  access_token = json["access_token"];
  userProperties.setProperty("access_token", access_token);
  userProperties.setProperty("access_time_expiry", new Date(mynow.getTime() + (30 * 60 * 1000)));
  
  return "Bearer " + access_token;   
}

function schwab_GetTokens(s){
// Receive the URI, strip out the code, and call Schwab to receive Bearer Token and Refresh Token
// Access token lasts for 30 minutes, refresh token lasts for 7 days before having to require user to authenticate again
// TODO: figure out a way to not require reauth every 7 days, since that is painfully stupid
//curl -X POST \https://api.schwabapi.com/v1/oauth/token \-H 'Authorization: Basic {BASE64_ENCODED_Client_ID:Client_Secret} \-H 'Content-Type: application/x-www-form-urlencoded' \-d 'grant_type=authorization_code&code={AUTHORIZATION_CODE_VALUE}&redirect_uri=https://127.0.0.1'
   
  mycode = decodeURIComponent(s.split("code=")[1].split("&session")[0]);

  var formData = {
    "grant_type" : "authorization_code",
    "code" : mycode,
    "redirect_uri" : "https://127.0.0.1"
  }

  var options = {
    "method" : "post",
    "headers": {
    "Authorization": "Basic " + encodedCredentials
    },
    "payload" : formData
  }

  var myurl="https://api.schwabapi.com/v1/oauth/token";
  var result=UrlFetchApp.fetch(myurl, options);
  Logger.log(result)

  //Parse JSON
  var contents = result.getContentText();
  var json = JSON.parse(contents);
  
  Logger.log(json)

  access_token = json["access_token"];
  refresh_token = json["refresh_token"];
    
  var mynow = new Date();

  userProperties.setProperty("access_token", access_token);
  userProperties.setProperty("access_time_expiry", new Date(mynow.getTime() + (30 * 60 * 1000))); 
  userProperties.setProperty("refresh_token", refresh_token);
  userProperties.setProperty("refresh_time_expiry", new Date(mynow.getTime() + (7 * 24 * 60 * 60 * 1000))); 

}

//*****************************UTILITY FUNCTIONS****************************************************************

function printUserProperties() {
  for (var property in userProperties.getProperties()) {
    Logger.log(property + ": " + userProperties.getProperty(property));
  }
}
