import { t2v, videoModel } from "../defaults"

export default videoModel(
  "ltx-2.5-fast",
  "LTX 2.5 Fast",
  { start: 1 },
  t2v("lightricks/ltx-2.5/text-to-video/fast"),
  {
    icon: "ltx",
    order: 63,
    settings: {
      aspectRatio: { type: "enum", values: ["16:9", "9:16"], default: "16:9" },
      resolution: {
        type: "enum",
        values: ["720p", "1080p", "2k", "4k"],
        default: "720p",
      },
      duration: { type: "range", min: 6, max: 10, default: 6, step: 2 },
    },
  }
)
