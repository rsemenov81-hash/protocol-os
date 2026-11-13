import { videoModel } from "../defaults"

export default videoModel(
  "kling-o3",
  "Kling O3",
  { start: 1, end: 1 },
  { firstLast: "kling-video/o3/first-last-frame" },
  {
    icon: "kling",
    order: 61,
    settings: {
      aspectRatio: {
        type: "enum",
        values: ["16:9", "9:16", "1:1"],
        default: "16:9",
      },
      duration: { type: "range", min: 3, max: 15, default: 5 },
    },
  }
)
