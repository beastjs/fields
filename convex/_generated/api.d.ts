/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as builds from "../builds.js";
import type * as chatActions from "../chatActions.js";
import type * as chats from "../chats.js";
import type * as colorhunt from "../colorhunt.js";
import type * as crons from "../crons.js";
import type * as deploymentRetention from "../deploymentRetention.js";
import type * as logs from "../logs.js";
import type * as presets from "../presets.js";
import type * as projectFiles from "../projectFiles.js";
import type * as projects from "../projects.js";
import type * as publishing from "../publishing.js";
import type * as rateLimits from "../rateLimits.js";
import type * as siteSlugs from "../siteSlugs.js";
import type * as sites from "../sites.js";
import type * as teams from "../teams.js";
import type * as users_m from "../users/m.js";
import type * as users_q from "../users/q.js";
import type * as users_v from "../users/v.js";
import type * as utils from "../utils.js";
import type * as validators from "../validators.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  builds: typeof builds;
  chatActions: typeof chatActions;
  chats: typeof chats;
  colorhunt: typeof colorhunt;
  crons: typeof crons;
  deploymentRetention: typeof deploymentRetention;
  logs: typeof logs;
  presets: typeof presets;
  projectFiles: typeof projectFiles;
  projects: typeof projects;
  publishing: typeof publishing;
  rateLimits: typeof rateLimits;
  siteSlugs: typeof siteSlugs;
  sites: typeof sites;
  teams: typeof teams;
  "users/m": typeof users_m;
  "users/q": typeof users_q;
  "users/v": typeof users_v;
  utils: typeof utils;
  validators: typeof validators;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
