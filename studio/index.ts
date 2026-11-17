// Seedance 2.5 text-to-video with the official Higgsfield SDK.
// Run: pnpm example  (reads HF_CREDENTIALS from .env.local, key-id:key-secret)
import { config, higgsfield } from "@higgsfield/client/v2"

const credentials = process.env.HF_CREDENTIALS
if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials)) {
  console.error("Set HF_CREDENTIALS in .env.local as key-id:key-secret.")
  process.exit(1)
}

// ponytail: SDK 0.2.6 stops polling only on completed/failed/nsfw, so a
// canceled request ends at maxPollTime and lands in the catch below.
config({ credentials, maxPollTime: 15 * 60_000 })

try {
  const result = await higgsfield.subscribe(
    "bytedance/seedance-2.5/text-to-video",
    {
      input: {
        prompt: "A cinematic scene at sunset",
        duration: 5,
        resolution: "720p",
        aspect_ratio: "16:9",
      },
      withPolling: true,
    }
  )
  const url = result.status === "completed" ? result.video?.url : undefined
  if (!url) {
    const reason =
      result.status === "nsfw" ? "blocked by content moderation" : "no video"
    console.error(
      `Request ${result.request_id} ended "${result.status}": ${reason}.`
    )
    process.exit(1)
  }
  console.log(url)
} catch (error) {
  // Print the message only: the SDK's HTTP error object carries request headers.
  const name = error instanceof Error ? error.name : "Error"
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Generation failed: ${name}: ${message}`)
  process.exit(1)
}
