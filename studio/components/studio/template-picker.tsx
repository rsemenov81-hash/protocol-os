/* eslint-disable @next/next/no-img-element */
"use client"

import type { KeyboardEvent, ReactNode } from "react"
import {
  FlaskConical,
  Package,
  Sunrise,
  Waves,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Templates — the "what you can make" examples. A `TemplateItem` seeds the
 * prompt dock (prompt text + optional model/settings) when its Try action fires.
 * `TemplateCard` and `ExamplePresets` render them; the Explore tab on Home uses
 * `ExamplePresets`.
 */

// Preview media: earlier Higgsfield outputs and Vitae Lab label renders from this repo.
const THUMBS = {
  lineup: "/presets/label-lineup.webp",
  vial: "/presets/compound-vial.webp",
  morning: "/presets/morning-cover.webp",
  night: "/presets/night-cover.webp",
  forest: "/presets/forest-light.webp",
  water: "/presets/water-loop.webp",
} as const

export interface TemplateItem {
  id: string
  title: string
  subtitle: string
  /** Free-form filter category used by the picker tabs. */
  category: string
  kind: "image" | "video"
  images: [string, string, string]
  icon: LucideIcon
  /** What the Try action puts in the dock. */
  prompt: string
  /** Catalog model id to switch to, when the template needs a specific one. */
  modelId?: string
  settings?: Record<string, unknown>
}

const PRODUCT_LIGHT =
  "One 1.2 m softbox camera-left at 45 degrees, white bounce card camera-right, soft contact shadow, 5200 K, ISO 200 grain, slightly desaturated. No mirror reflections, no HDR glow, no floating products, no extra text, no people."

export const TEMPLATES: TemplateItem[] = [
  {
    id: "label-lineup",
    title: "Label lineup",
    subtitle: "Vitae Lab containers in catalogue order",
    category: "product",
    kind: "image",
    images: [THUMBS.lineup, THUMBS.vial, THUMBS.morning],
    icon: Package,
    modelId: "ideogram-4",
    settings: { aspectRatio: "16:9" },
    prompt: `Product photograph of five supplement containers left to right on honed limestone: three matte bone tubs labelled "Creatine", "Whey Isolate" and "Collagen", then two amber glass bottles labelled "Magnesium" and "Vitamin D3". Labels on textured matte bone paper with the "Vitae Lab" wordmark, straight-on, equal gaps, warm grey plaster backdrop. ${PRODUCT_LIGHT}`,
  },
  {
    id: "compound-still",
    title: "Compound still life",
    subtitle: "Amber vial, stone and raking light",
    category: "product",
    kind: "image",
    images: [THUMBS.vial, THUMBS.lineup, THUMBS.night],
    icon: FlaskConical,
    modelId: "soul-2",
    settings: { aspectRatio: "16:9", resolution: "1080p" },
    prompt:
      "Unlabelled amber glass vial with a brushed silver cap on dark green marble, a clear glass prism beside it, low raking sunlight casting long caustics across the stone, deep shadows, 90 mm lens, f/8, quiet editorial mood, no text, no people.",
  },
  {
    id: "ritual-cover",
    title: "Ritual cover",
    subtitle: "Morning or night cover for a protocol app",
    category: "covers",
    kind: "image",
    images: [THUMBS.morning, THUMBS.night, THUMBS.forest],
    icon: Sunrise,
    modelId: "soul-2",
    settings: { aspectRatio: "16:9", resolution: "1080p" },
    prompt:
      "Calm morning still life: a glass of water on a pale limestone ledge, olive branch at the edge of frame, low golden sunlight with leaf shadows on a plaster wall, generous empty space on the left for a title, soft and uncluttered, no text, no people.",
  },
  {
    id: "water-loop",
    title: "Ambient water loop",
    subtitle: "Silent background motion",
    category: "motion",
    kind: "video",
    images: [THUMBS.water, THUMBS.forest, THUMBS.night],
    icon: Waves,
    modelId: "seedance-2.5",
    settings: {
      aspectRatio: "16:9",
      duration: 6,
      resolution: "720p",
      generateAudio: false,
    },
    prompt:
      "Locked-off shot of clear water gently rippling over pale stone in soft daylight, slow caustic light patterns drifting, calm and seamless enough to loop, no camera movement, no text, no people.",
  },
]

function gradientFromSeed(seed: string): string {
  let hash = 0
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  const start = hash % 360
  const end = (start + 36 + ((hash >>> 8) % 72)) % 360
  return `linear-gradient(135deg, hsl(${start} 62% 52%) 0%, hsl(${end} 76% 27%) 100%)`
}

function GradientBadge({ as: Glyph, seed }: { as: LucideIcon; seed: string }) {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/25 text-white shadow-[0_5px_3px_rgba(0,0,0,0.08),inset_0_3px_5px_rgba(255,255,255,0.24)]">
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: gradientFromSeed(seed) }}
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 mix-blend-overlay"
      />
      <Glyph className="relative size-5" />
    </span>
  )
}

const TRIPTYCH = [
  "rounded-l-2xl rounded-r-sm",
  "rounded-sm",
  "rounded-r-2xl rounded-l-sm",
] as const

export interface TemplateCardProps {
  template: TemplateItem
  variant?: "single" | "triptych"
  onTry: (template: TemplateItem) => void
  tryLabel?: ReactNode
}

export function TemplateCard({
  template,
  variant = "single",
  onTry,
  tryLabel = "Try",
}: TemplateCardProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onTry(template)
    }
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Use template: ${template.title}`}
      className="relative flex cursor-pointer flex-col gap-2 rounded-[20px] bg-white/5 p-2 shadow-[0_2px_6px_rgba(0,0,0,0.15)] transition-[transform,background-color] duration-200 hover:z-[1] hover:-translate-y-0.5 hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0"
      onClick={() => onTry(template)}
      onKeyDown={onKeyDown}
    >
      <div className="flex h-60 items-stretch gap-1.5">
        {variant === "triptych" ? (
          template.images.map((src, i) => (
            <div
              key={i}
              className={cn(
                "min-w-0 flex-1 overflow-hidden border border-white/10",
                TRIPTYCH[i]
              )}
            >
              <img
                src={src}
                alt={`${template.title} — shot ${i + 1}`}
                className="size-full object-cover"
              />
            </div>
          ))
        ) : (
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10">
            <img
              src={template.images[0]}
              alt={template.title}
              className="size-full object-cover"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 px-2 py-1">
        <GradientBadge as={template.icon} seed={template.id} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">
            {template.title}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {template.subtitle}
          </span>
        </div>
        <Button
          size="sm"
          className="rounded-full font-semibold"
          onClick={(event) => {
            event.stopPropagation()
            onTry(template)
          }}
        >
          {tryLabel}
        </Button>
      </div>
    </div>
  )
}

export interface ExamplePresetsProps {
  items: TemplateItem[]
  onUse: (template: TemplateItem) => void
  tryLabel?: ReactNode
  className?: string
}

/** The Explore grid: two columns of `TemplateCard`s. */
export function ExamplePresets({
  items,
  onUse,
  tryLabel = "Try",
  className = "w-full max-w-[900px]",
}: ExamplePresetsProps) {
  return (
    <div
      className={cn("grid w-full grid-cols-1 gap-5 sm:grid-cols-2", className)}
    >
      {items.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          onTry={onUse}
          tryLabel={tryLabel}
        />
      ))}
    </div>
  )
}
