import { imageModel } from "../defaults"

export default imageModel(
  "ideogram-4",
  "Ideogram 4.0",
  { text: "ideogram/v4.0" },
  {
    icon: "ideogram",
    order: 42,
    // ponytail: docs take one image_url, not image_urls; references off until mapped.
    roles: {},
    settings: {
      aspectRatio: {
        type: "enum",
        values: [
          "1:1",
          "4:3",
          "3:4",
          "16:9",
          "9:16",
          "3:2",
          "2:3",
          "4:5",
          "5:4",
        ],
        default: "1:1",
      },
    },
  }
)
