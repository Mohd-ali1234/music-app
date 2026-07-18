Pod::Spec.new do |s|
  s.name = 'NativeStreamResolver'
  s.version = '1.0.0'
  s.summary = 'On-device stream resolution bridge.'
  s.description = 'Android yt-dlp bridge with an iOS unsupported fallback module.'
  s.license = { :type => 'MIT' }
  s.author = 'Music Player'
  s.homepage = 'https://example.invalid/native-stream-resolver'
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://example.invalid/native-stream-resolver.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
end
