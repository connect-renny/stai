// Read by `npm run prefix` (postcss-cli --replace). Without this file the CLI
// exits with "You did not set any plugins" and the build stops.
//
// Autoprefixer takes its target browsers from the `browserslist` field in
// package.json — change support there, not here.
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};
