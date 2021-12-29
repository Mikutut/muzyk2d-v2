# Todo

---

- [ ] Implement better error handling:
  - [ ] Provide base interfaces as well as extensions for each type of error
  - [ ] Attach error handler to each command that will be invoked on command failure
  - [ ] Utilize try/catch blocks wherever possible
- [ ] Implement commands interpreter:
  - [ ] Define commands/prefix/alias schema
  - [ ] Add utility functions (invoking commands, finding/getting commands/parameters, adding/deleting runtime commands etc.)
  - [ ] Implement aliases handling
  - [ ] Implement missing command handling
  - [ ] Implement insufficient parameters handling
  - [ ] Implement incorrect parameters handling
  - [ ] Make global commands list
  - [ ] Implement dev-only/not invokable by chat commands
- [ ] Implement separate bot configuration:
  - [ ] Keep read-on-runtime-only values inside .env file
  - [ ] Add global config - applies for every guild
  - [ ] Add local configs for each guild
  - [ ] Add global values' overrides for each guild
- [ ] Implement better logging:
  - [ ] Implement saving logs to file
  - [ ] Implement different types of logs (errors, successes, info etc.)
  - [ ] Implement different styles for different types of logs
  - [ ] Implement Promise-like style of invoking logs (for non-blocking IO and better error handling)
- [ ] Implement voice features:
  - [ ] Implement joining/leaving voice channels
  - [ ] Implement proper voice connection handling:
    - [ ] Handle unexpected connection loses
    - [ ] Prevent Discord API library from crashing (that might be hard since I don't know what was crashing it last time ¯\_(ツ)_/¯)
  - [ ] Implement no users in channel/long client inactivity detection
- [ ] Implement data collection through YouTube API:
  - [ ] Get YouTube Data API access tokens
  - [ ] Implement collecting metadata about videos from YouTube
  - [ ] Add appropriate interfaces for needed data only
  - [ ] Implement caching metadata to limit API requests
- [ ] Implement audio playback:
  - [ ] Implement downloading/playing video stream off of YouTube
  - [ ] Implement playlist functionality:
    - [ ] Add global playlist
    - [ ] Implement utility functions (adding/deleting playlist entries, flushing playlist etc.)
    - [ ] Implement bot state awareness (active/idle)
    - [ ] Add different playback modes (normal/loop one entry/loop entire playlist etc.)
- [ ] Implement Rich Presence
- [ ] Implement status change
- [ ] Design Muzyk2D documentation:
  - [ ] Used libraries
  - [ ] Muzyk2D installation and usage instructions
  - [ ] Utilities
  - [ ] Environmental variables
  - [ ] Commands

---

## [Mikut](https://mikut.dev) 2020-2021