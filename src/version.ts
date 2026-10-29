import pkg from '../package.json';

declare const __APP_BUILD_DATE__: string | undefined;

/**
 * InsightHub Official Application Version
 * Strictly dynamic from package.json version.
 * Decoupled from internal migration schema version (which is numeric V10).
 */
export const APP_VERSION: string = pkg.version;
export const APP_NAME = 'InsightHub';
export const APP_BUILD_DATE: string =
  typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : new Date().toISOString();
export const LICENSE_NAME = 'The Mutualist License v1.3';
