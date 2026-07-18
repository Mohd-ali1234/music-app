package expo.modules.nativestreamresolver

import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class NativeStreamResolverModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeStreamResolver")
    AsyncFunction("resolveStreamUrl") { videoId: String ->
      if (!VIDEO_ID.matches(videoId)) throw StreamResolverException("invalid_video_id", "Invalid YouTube video ID")
      val context = appContext.reactContext?.applicationContext
        ?: throw StreamResolverException("no_context", "Android application context is unavailable")
      if (!Python.isStarted()) Python.start(AndroidPlatform(context))
      val executor = Executors.newSingleThreadExecutor()
      try {
        val output = executor.submit<String> {
          Python.getInstance().getModule("stream_resolver").callAttr("resolve_stream", videoId).toString()
        }.get(15, TimeUnit.SECONDS)
        val result = JSONObject(output)
        val streamUrl = result.optString("streamUrl")
        if (streamUrl.isBlank()) throw StreamResolverException("invalid_output", "yt-dlp returned no stream URL")
        val headersJson = result.optJSONObject("headers") ?: JSONObject()
        val headers = headersJson.keys().asSequence().associateWith { headersJson.getString(it) }
        mapOf("streamUrl" to streamUrl, "headers" to headers)
      } catch (error: TimeoutException) {
        throw StreamResolverException("timeout", "Stream resolution exceeded 15 seconds")
      } catch (error: StreamResolverException) {
        throw error
      } catch (error: Exception) {
        throw StreamResolverException("resolver_failed", error.cause?.message ?: error.message ?: "yt-dlp failed")
      } finally { executor.shutdownNow() }
    }.runOnQueue(Queues.DEFAULT)
  }
  private companion object { val VIDEO_ID = Regex("^[A-Za-z0-9_-]{11}$") }
}

class StreamResolverException(code: String, message: String) : CodedException(code, message, null)
