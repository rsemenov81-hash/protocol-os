import { imageModel } from "../defaults"

export default imageModel(
  "recraft-4.1",
  "Recraft 4.1",
  { text: "recraft/v4.1/text-to-image" },
  {
    icon: "recraft",
    order: 43,
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
