import { defineConfig } from 'vite';

function getPagesBase() {
  const repository = process.env.GITHUB_REPOSITORY;
  const repoName = repository?.split('/')[1];

  if (!repoName || repoName.endsWith('.github.io')) {
    return '/';
  }

  return `/${repoName}/`;
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? getPagesBase() : '/',
}));
