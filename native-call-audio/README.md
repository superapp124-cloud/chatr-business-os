# CHATR+ Native Call Progress Audio

This folder documents the shared call-progress tone contract.

Runtime implementations live in:

- Android: `android/app/src/main/java/com/chatr/app/nativecallaudio/ToneManager.kt`
- iOS native: `ios-native/CHATR/CHATR/CallKit/ToneManager.swift`
- Web-to-native bridge: `src/utils/callProgressTones.ts`

The current engine synthesizes carrier-style tone buffers natively at runtime instead of shipping large audio files. That keeps startup small while still routing through native audio focus, Bluetooth, speaker, and CallKit/Telecom audio sessions.

Tone patterns:

- `RINGBACK`: 2 seconds on, 4 seconds off, loop
- `BUSY`: 0.5 seconds on, 0.5 seconds off, auto-disconnect after 6.5 seconds
- `FAILED`: short triple beep, auto-disconnect after playback
- `ENDED`: short soft one-shot
- `RECONNECTING`: soft pulse until ICE/network recovery completes
