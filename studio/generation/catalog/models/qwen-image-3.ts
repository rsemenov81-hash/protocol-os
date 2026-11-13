import { imageModel } from "../defaults"

export default imageModel(
  "qwen-image-3",
  "Qwen Image 3",
  { text: "alibaba/qwen-image-3/text-to-image" },
  {
    icon: "qwen",
    order: 44,
    roles: {},
    settings: {
      aspectRatio: {
        type: "enum",
        values: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
        default: "1:1",
      },
      resolution: { type: "enum", values: ["1k", "2k"], default: "1k" },
    },
  }
)
