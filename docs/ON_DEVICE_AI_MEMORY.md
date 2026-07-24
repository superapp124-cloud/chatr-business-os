# On-Device AI Memory

## Route

CHATR tries local Gemini Nano first for private assistive tasks, then silently falls back to the existing Supabase edge functions when the native runtime is missing, disabled, downloading, or unavailable.

## Native Contract

- Capacitor plugin: `OnDeviceAi`
- Methods: `checkAvailability({ downloadIfNeeded })`, `generate({ prompt, task, maxInputWords, maxOutputTokens })`
- Android service: `OnDeviceAiService`
- Runtime: ML Kit GenAI Prompt API backed by Android AICore
- Tasks: `summarize`, `smart_replies`, `smart_compose`, `general`

## Privacy

Summaries and reply suggestions send the same prompt to only one route at a time. If native generation succeeds, no cloud edge function is invoked. If native generation fails, the existing cloud function is used without surfacing a toast.

## Toggle

The Settings privacy toggle stores `chatr.onDeviceAi.enabled` in `localStorage` immediately and mirrors `on_device_ai_enabled` into `profiles.privacy_settings` when privacy settings are saved.

## Build Note

After pulling these changes, run:

```bash
npx cap sync android
```

Then rebuild Android so `OnDeviceAiPlugin` is registered before `BridgeActivity.super.onCreate`.
