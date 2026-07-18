import ExpoModulesCore

public final class NativeStreamResolverModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeStreamResolver")
    AsyncFunction("resolveStreamUrl") { (_: String) throws -> [String: Any] in
      throw NativeStreamResolverError.unsupportedPlatform
    }
  }
}

enum NativeStreamResolverError: CodedError {
  case unsupportedPlatform
  var code: String { "unsupported_on_ios" }
  var description: String? { "On-device yt-dlp execution is intentionally unavailable on iOS." }
}
