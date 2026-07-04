# automovie

**Make characters move with AI ??then render them the same way every time.**

automovie is an experiment in a different way to generate animation. Instead of asking an AI to paint every pixel of every frame (the way image/video diffusion models do), automovie asks the AI to do something much smaller: **describe how to pose and move a character**. A plain, deterministic engine then turns that description into the actual picture.

Think of it like a **puppet and a puppeteer**. The puppet (a 3D model with a skeleton) never changes. The AI is the puppeteer ??it only decides *"bend this elbow, turn the head, smile, take a step."* Because the puppet stays fixed and only the strings move, the character looks consistent from frame to frame, and you can replay or tweak any moment exactly. That frame-to-frame consistency is the thing diffusion struggles with.

## Why this is interesting

When an AI generates pixels directly, three things hurt:

- ?뮯 **Cost** ??every frame is a full, expensive generation.
- ?렡 **Consistency** ??the character's face subtly changes shot to shot.
- ?봺 **Reproducibility** ??you can't re-render the exact same scene later.

automovie trades the pixel-painting for **structured instructions**. The AI outputs data (poses, keyframes, expressions), and a normal rendering engine draws the frames. Cheap, consistent, and reproducible.

## The clever part: the AI can't draw the impossible

Here's the trick that makes it work. An elbow can only bend so far. A knee doesn't bend backward. So automovie writes those real-world limits down as rules the engine checks.

If the AI ever asks for an impossible pose, the engine **catches it and explains what's wrong** ??*"the left elbow is at 175째, but the anatomical max is 150째"* ??and the AI tries again with that feedback. The result keeps getting corrected until it's physically valid. This validate-and-retry loop is what turns a fuzzy AI into something dependable.

## Where it's heading

The long-term dream is bigger than one character. automovie aims to describe **every object and every motion** ??bodies, cameras, lights, props, whole scenes over time ??well enough to assemble a short film from nothing but those descriptions.

It's an early, work-in-progress project. The foundations come first; the fancy parts get added on top, never by starting over.

## What's inside

automovie is a monorepo. The pieces that work today:

| Package | What it does |
|---|---|
| [`@automovie/interface`](./packages/interface) | The shared vocabulary ??the data shapes the AI fills in (poses, motion, expressions, scenes). |
| [`@automovie/engine`](./packages/engine) | The deterministic brain ??math, posing, and the rule-checks (like joint limits). No graphics library. |
| [`@automovie/viewer`](./packages/viewer) | Shows the result on screen with [three.js](https://threejs.org). A *viewer*, not an editor. |
| [`@automovie/ingest`](./packages/ingest) | Imports your own glTF/VRM 3D models so automovie can animate them. |
| [`@automovie/render`](./packages/render) | Headless rendering & export. |
| [`@automovie/playground`](./packages/playground) | A sandbox for trying things out by hand. |

The AI layer (`agent`) and a friendly character creator (`editor`) are planned but not built yet.

## Try it

```bash
pnpm install      # install everything
pnpm run build    # build the packages
pnpm run test     # run the test suite
```

You'll need [Node.js](https://nodejs.org) 22+ and [pnpm](https://pnpm.io) 10.

## Status

The deterministic core is up and running ??you can build a character, pose it, check the poses against real joint limits, and view the result. The AI that *generates* those poses is the next big piece.

Right now the focus is **motion before models**: we're getting the animation pipeline solid with simple stick-figure rigs first, and saving realistic, good-looking character art for later. Walk before you run.

Curious about the deeper design thinking? Each package has its own README, and [`AGENTS.md`](./AGENTS.md) is the map for contributors.

## License

[MIT](./LICENSE) 짤 Samchon
