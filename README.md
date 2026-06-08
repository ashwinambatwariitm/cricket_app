# CricTrack

A cricket match manager and live scoring app. It runs entirely in the browser
with no build step and no server. Match data is saved in the browser using
local storage, so your players, teams, and match history stay on your device.

## Features

- Add players with name, role, and an optional photo with a built in cropper
- Assign players to two teams and mark a captain for each
- Choose the number of overs and run a toss to decide who bats first
- Live ball by ball scoring with runs, wides, no balls, and wickets
- Runs scored off a no ball are credited to the batsman
- Dismissals with full detail: bowled, lbw, caught, stumped, run out, hit wicket
- Run out on a no ball and stumping or run out on a wide
- Per batsman and per bowler scorecards, including wides and no balls
- Automatic rules: over ends after six legal balls, a bowler cannot bowl two
  overs in a row, an out batsman cannot bat again, and the chase ends the moment
  the target is reached
- Undo for any action and a way to change a wrongly selected batsman or bowler
- Match history with a detailed breakdown for each completed match
- Backup and restore from the Backup tab, either as a downloaded file or to
  Google Drive
- Export the full match history to an Excel file from the History tab
- Generate a shareable winner image at the end of a match

## Files

- index.html
  The full app. Open this file to use CricTrack.
- crictrack-engine.js
  The scoring engine. All cricket rules live here as plain functions. The app
  loads this file, and the test suite imports the same file, so there is one
  source of truth.
- crictrack.test.js
  The test suite for the engine.

## How to run the app

Open index.html in any modern web browser. You can double click the file, or
open it from the browser using File then Open.

Keep all three files together in the same folder. The page loads the engine
using a relative path, so the engine file must sit next to index.html.

## How to run the tests

You need Node.js installed. From inside this folder, run:

    node crictrack.test.js

The script prints each check and a final summary. It exits with a non zero code
if any test fails, so it also works in a continuous integration pipeline.

## Backup and restore

Open the Backup tab in the app. There are two ways to keep your data safe.

Backup file (works everywhere, no setup):

- Download backup file saves a .json file with all your players, teams, and
  match history.
- Restore from file loads such a file back and reloads the app.
- Tip: save the downloaded file inside your Google Drive folder, or your Google
  Drive desktop sync folder, to keep an off device copy.

Google Drive upload (needs a one time setup and https hosting):

- This uploads the same backup straight to your Google Drive and can restore
  from it later.
- It only works when the app is served over https, for example GitHub Pages. It
  does not work when you open the file directly from disk.
- Setup steps:
  1. Go to the Google Cloud Console and create a project.
  2. Configure the OAuth consent screen and add yourself as a test user.
  3. Create an OAuth client ID of type Web application.
  4. Under Authorized JavaScript origins, add the URL where you host the app,
     for example https://yourname.github.io
  5. Copy the client ID and paste it into the GDRIVE_CLIENT_ID value near the top
     of index.html.
- The app requests only the drive.file scope, so it can see and change just the
  one backup file it creates, not the rest of your Drive.

## Export to Excel

Open the History tab and use Export to Excel. This downloads a .xlsx file you
can open in Excel or Google Sheets. It contains three sheets:

- Matches: one row per match with a match number, date, time, both team scores,
  the winner, the result, and the number of overs.
- Batting: one row per batsman per match with runs, balls, fours, sixes, and how
  they were out.
- Bowling: one row per bowler per match with overs, runs, wickets, wides, and no
  balls.

This file is for keeping records and analysis. To move your data to another
device, use the JSON backup on the Backup tab instead, because the Excel file
does not include photos and cannot be loaded back into the app.

## How it is organised

The cricket rules are kept separate from the screen. The engine takes the
current match state and a ball event, and returns the next match state. The app
only handles the display and saving to local storage. This means the same logic
that runs in the browser is the logic that the tests check.

## Notes

- All data is stored in the browser. Clearing site data will remove saved
  players and match history.
- The app uses React from a content delivery network, so the first load needs an
  internet connection.
