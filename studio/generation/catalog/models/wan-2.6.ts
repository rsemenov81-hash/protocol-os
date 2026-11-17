import { t2v, videoModel } from "../defaults"

export default videoModel(
  "wan-2.6",
  "Wan 2.6",
  { start: 1 },
  t2v("wan/v2.6/text-to-video"),
  {
    icon: "wan",
    order: 53,
    settings: {
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      duration: { type: "range", min: 5, max: 15, default: 5, step: 5 },
    },
  }
)
