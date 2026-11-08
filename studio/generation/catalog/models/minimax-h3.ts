import { t2v, videoModel } from "../defaults"

export default videoModel(
  "minimax-h3",
  "MiniMax H3",
  { start: 1 },
  t2v("minimax/h3/text-to-video"),
  {
    icon: "minimax",
    order: 55,
    settings: {
      aspectRatio: {
        type: "enum",
        values: ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
        default: "auto",
      },
      duration: { type: "range", min: 5, max: 15, default: 5 },
    },
  }
)
