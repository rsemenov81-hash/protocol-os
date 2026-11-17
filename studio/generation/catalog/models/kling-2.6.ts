import { t2v, videoModel } from "../defaults"

export default videoModel(
  "kling-2.6",
  "Kling 2.6",
  { start: 1 },
  t2v("kling-video/v2.6/pro/text-to-video"),
  {
    icon: "kling",
    order: 59,
    settings: {
      aspectRatio: {
        type: "enum",
        values: ["16:9", "9:16", "1:1"],
        default: "16:9",
      },
      duration: { type: "range", min: 5, max: 10, default: 5, step: 5 },
    },
  }
)
