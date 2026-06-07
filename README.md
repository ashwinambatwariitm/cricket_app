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
