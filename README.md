# schwab-googlesheets
Script add in for Google Sheets to pull in Charles Schwab account trading data in via their API

Credits go to the following for laying the groundwork on the TD API to Google Sheets, which has been heavily modified to support the new Schwab API.

@santsleo https://github.com/santsleo/AmeritradeAPIonGoogleSheets

@kohjb https://github.com/kohjb/AmeritradeAPIwGoogleScripts

To use:

## Set up the Schwab API:

1. Sign up for a developer account from https://developer.schwab.com/register
1. Create an app that uses the Trader API - Indidual, Account and Trading Production.
1. Set the callback URL to https://127.0.0.1 and save.
1. You'll need to wait until the app changes to "Ready for Use" before things will work - this can take some time, maybe a week or more.
1. Grab the App Key and Secret from your app, as you will need this later.

## In Google Sheets:

1. Create a new sheet, and navigate to Tools > Script editor
1. Add the 2 files from this repository into Files on the left side, and save.
1. Go to Project Settings and navigate to the script properties section. Add a script property of "schwab_apikey" and enter your App Key from the Schwab app, and then add a script property of "schwab_secret" and enter your Secret from the Schwab app.
1. Go to Schwab.gs, and click run. Google will make you approve this app to run.
1. Exit script editor and back on the Google Sheet, you should now see a panel on the right side. If you don't see the right panel, go to Schwab API > Authenticate. Click on the link in the panel to login.
1. Go through the login process to authorize this to connect to your Schwab account. You will be rerouted to a dead link, which is expected. Copy the URL that is now showing in the address bar.
1. Paste the URL into Response text and then click the Step 2 button. The script will properly extract your code in the URL and get the needed refresh and access tokens.
1. Now that your account is connected and you can start to call functions from the Google Sheet itself.

## Functions available:

* schwab_Positions
* schwab_Balance
* schwab_GetQuote

Easiest way to simply test that it is working, is to enter "=schwab_Positions()" into a single cell and press enter. Your current positions should now be shown in the Google Sheet.

## Note:
Unlike the TD Ameritrade API where you only had to authenticate every 90 days, the Schwab API makes you authenticate every 7 days! Poor design of their API, but have not found any workaround to this yet.
