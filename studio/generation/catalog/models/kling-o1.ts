import { videoModel } from "../defaults"

export default videoModel(
  "kling-o1",
  "Kling O1 (Omni)",
  { start: 1, end: 1 },
  { firstLast: "kling-video/omni/first-last-frame" },
  {
    icon: "kling",
    order: 62,
    requiredRoles: ["start"],
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
