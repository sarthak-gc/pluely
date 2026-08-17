# Pluely — internal build

Works on both Apple Silicon and Intel Macs (universal binary), macOS 11+.

## Install

1. Open the `.dmg` and drag **Pluely** into your Applications folder.
2. This build is not notarized by Apple, so macOS quarantines it. Run this once
   in Terminal:

   ```
   xattr -dr com.apple.quarantine /Applications/Pluely.app
   ```

   Without it you'll see "Pluely is damaged and can't be opened." The app is
   ad-hoc signed, not malicious — this is just what unsigned apps look like to
   Gatekeeper.
3. Launch Pluely from Applications.

## Grant permissions

macOS will prompt on first launch. If you miss a prompt, set them manually in
System Settings → Privacy & Security:

- **Microphone** — voice input
- **Screen & System Audio Recording** — screenshots and system audio capture
- **Accessibility** — global keyboard shortcuts

Quit and relaunch Pluely after granting these.

## Add your own API key

Pluely ships with no API key. Open Settings and add your own for whichever
provider you want (OpenAI, Anthropic, Groq, etc.) — one for speech-to-text and
one for chat. Keys are stored locally in the macOS keychain; nothing goes
anywhere except the provider you configure.

## Keyboard shortcuts

- `cmd+\` — show/hide the window
- `cmd+shift+i` — focus input
- `cmd+shift+d` — toggle dashboard
- `cmd+shift+s` — screenshot
- `cmd+shift+a` — audio recording
- `cmd+shift+m` — system audio

## Notes

- Some features are gated behind an upstream Pluely license and will be
  inactive in this build.
- The app checks pluely.com for updates. Taking one replaces this build with
  the official public release.
