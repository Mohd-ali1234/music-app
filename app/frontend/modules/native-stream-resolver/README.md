# Native Stream Resolver

Android bundles Chaquopy and `yt-dlp==2026.6.9` to resolve a YouTube video ID
on the device's network. It supports `armeabi-v7a`, `arm64-v8a`, and `x86_64`
and requires Android API 24 or later.

iOS deliberately reports `unsupported_on_ios`; the app then uses the backend
resolver. Do not add a Python runtime or executable extractor to the iOS target
without a separate App Store policy and rights review.

Build a custom development client after native changes. Expo Go does not include
this module.
