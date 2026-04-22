# Crew Earth

An interactive Three.js portrait of Earth built around one idea from astronaut Christina Koch's Artemis II homecoming remarks: Earth is not just a planet to look at, but a shared vessel to care for.

[Live site](https://ghaythfuad.github.io/crew-earth/) • [GitHub repo](https://github.com/GhaythFuad/crew-earth)

## Inspiration

This project was inspired by Christina Koch's reflection after Artemis II, where she described Earth as a shared lifeboat in space and said, "planet Earth, you are a crew."


[![Christina Koch's "planet Earth, you are a crew" remarks](https://img.youtube.com/vi/8yhqwxJWWhg/hqdefault.jpg)](https://www.youtube.com/shorts/8yhqwxJWWhg)

Additional context:

- [NASA Curious Universe transcript: Artemis II crew comes home](https://www.nasa.gov/podcasts/curious-universe/artemis-ii-crew-comes-home/)
- [Essay that helped shape this direction](https://michelecaracappa.substack.com/p/planet-earth-you-are-a-crew-lessons)

## What The Project Does

`Crew Earth` renders a stylized-but-grounded view of Earth in space with:

- day and night texture blending
- an atmospheric rim and inner scattering
- cloud layers and cloud shadows
- ocean highlights and city lights
- a quote treatment inspired by Christina Koch's words
- a minimal audio player and fullscreen mode
- a public presentation mode plus an admin tuning mode

## Stack

- [Three.js](https://threejs.org/) for rendering
- [Vite](https://vite.dev/) for development and build tooling
- Static assets under [`public/textures`](public/textures)

## Assets And Attribution

- Earth surface base imagery is derived from [Natural Earth III](https://www.shadedrelief.com/natural3/) by Tom Patterson.
- Additional Earth/night and related reference material comes from [NASA](https://www.nasa.gov/).
- The project soundtrack currently points to [Silent Poets - Asylums for the Feeling](https://www.youtube.com/watch?v=R2t8pHCbVFc) via an embedded YouTube player.

## Running Locally

Prerequisites:

- Node.js 18+

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Vite will print the local URL in the terminal, usually `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## Interaction

Public mode:

- drag to orbit
- scroll or pinch to zoom
- use the fullscreen button for an immersive view
- tap the play button to reveal the soundtrack controls and waveform

Admin mode:

- open the site with `?admin=1`
- adjust surface, atmosphere, lighting, clouds, and motion from the control panel
- switch between quote layouts while tuning the presentation

## Deployment

This repo is configured for GitHub Pages with GitHub Actions.

Once GitHub Pages is set to `GitHub Actions`, every push to `main` rebuilds and publishes the site automatically through [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Notes

- The project currently prioritizes a cinematic Earth presentation that is being tuned toward stronger science accuracy.
- Texture paths are configured to work both locally and on GitHub Pages.
- The default public quote treatment is intentionally subtle so the planet stays the primary visual subject.
