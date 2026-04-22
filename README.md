# Earth

A realistic 3D Earth visualization built with Three.js. Features day/night cycle, cloud layers, atmospheric scattering, ocean specular highlights, and a star field.

## Prerequisites

- Node.js (v18+)

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173).

## Build for Production

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This project includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

Once the repository is pushed to GitHub:

1. Open the repository `Settings`
2. Go to `Pages`
3. Set the source to `GitHub Actions`
4. Push to `main`

The workflow will build the Vite app and publish `dist/` to GitHub Pages automatically.

## Controls

- **Drag** to orbit around the Earth
- **Scroll** to zoom in/out
- Use the **slider panel** (top-right) to adjust saturation, brightness, atmosphere, clouds, lighting, and more
- Click the canvas to collapse the panel; click **Controls** button to reopen it
