# Todo

---

- [x] Introduce better code-splitting
- [x] Implement commands interpreter:
  - [x] Define commands/prefix schema
  - [x] Make global commands list
  - [x] Add utility functions (invoking commands, finding/getting commands/parameters, adding/deleting runtime commands etc.)
  - [x] Implement dev-only/not invokable by chat commands
  - [x] Implement missing command/insufficient parameters/incorrect parameters detection
  - [x] Implement proper aliases handling
- [x] Implement ability to join/leave voice channel
- [x] Implement no users in voice chat detection
- [x] Implement inactivity timeout detection
- [x] Implement data collection through YouTube API:
  - [x] Get YouTube Data API access tokens
  - [x] Implement collecting metadata about videos from YouTube
  - [x] Implement caching metadata to limit API requests
- [ ] Implement audio playback:
  - [x] Implement downloading/playing video stream off of YouTube
  - [ ] Implement playlist functionality:
    - [x] Add global playlist
    - [x] Implement utility functions (adding/deleting playlist entries, flushing playlist etc.)
    - [x] Implement bot state awareness (active/idle)
    - [ ] Add different playback modes (normal/loop one entry/loop entire playlist etc.)
- [x] Reintroduce basic checkers
- [ ] Implement proper message replies
- [ ] Implement Rich Presence
- [ ] Implement status change
- [ ] Replace all normal functions with Promises where necessary
- [ ] Implement better logging:
  - [ ] Implement saving logs to file
  - [ ] Implement different types of logs (errors, successes, info etc.)
  - [ ] Implement different styles for different types of logs
  - [ ] Implement Promise-like style of invoking logs (for non-blocking IO and better error handling)
- [x] Rewrite error interface and enum to support all error components:
  - [x] Implement such change in all error interface and enum uses
- [ ] Extract commands from TypeScript file to JSON document:
  - [ ] Split command definitions from their handlers and implement reattaching them in code
- [ ] Design Muzyk2D documentation:
  - [ ] Used libraries
  - [ ] Muzyk2D installation and usage instructions
  - [ ] Utilities
  - [ ] Environmental variables
  - [ ] Commands
- [ ] Change message replies implementation from manual to precrafted list with parameters
- [ ] Redesign todo list into more flexible table rather than a list

---

### [Mikut](https://mikut.dev) 2020-2021
