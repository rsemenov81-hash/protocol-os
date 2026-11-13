import { videoModel } from "../defaults"

export default videoModel(
  "kling-2.5",
  "Kling 2.5",
  { start: 1 },
  { image: "kling-video/v2.5-turbo/standard/image-to-video" },
  {
    icon: "kling",
    order: 60,
    requiredRoles: ["start"],
    settings: {
      duration: { type: "range", min: 5, max: 10, default: 5, step: 5 },
    },
  }
)
