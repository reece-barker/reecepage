// Asset pipeline. Gulp runs the tasks, the work itself is done with plain Node APIs and three small libraries
// (sass, terser, svgo) so there is no tangle of gulp plugins to keep up to date.
//
//   npx gulp            development build (readable files, source maps)
//   npx gulp watch      development build, then rebuild on every change
//   NODE_ENV=production npx gulp build   minified, hashed, precompressed, manifest written
//
// Output goes to public/assets/, which is generated and never committed.
import gulp from "gulp";
import { styles } from "./scripts/gulp/styles.js";
import { scripts } from "./scripts/gulp/scripts.js";
import { images, fonts, vendor } from "./scripts/gulp/copy.js";
import { revision } from "./scripts/gulp/revision.js";
import { compress } from "./scripts/gulp/compress.js";
import { clean } from "./scripts/gulp/clean.js";
import { PRODUCTION, PATHS } from "./scripts/gulp/settings.js";

const { series, parallel, watch: watchFiles } = gulp;

const assets = parallel(styles, scripts, images, fonts, vendor);

export const build = PRODUCTION ? series(clean, assets, revision, compress) : series(clean, assets);

export function watch() {
  watchFiles(`${PATHS.styles}/**/*.scss`, styles);
  watchFiles(`${PATHS.scripts}/**/*.js`, scripts);
  watchFiles(`${PATHS.images}/**/*`, images);
  watchFiles(`${PATHS.fonts}/**/*`, fonts);
}

export const dev = series(build, watch);
export { clean, styles, scripts, images, fonts, vendor };
export default build;
