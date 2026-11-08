import { imageModel } from "../defaults"

export default imageModel(
  "z-image-turbo",
  "Z-Image Turbo",
  { text: "z-image/turbo" },
  {
    icon: "z-image",
    order: 45,
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
