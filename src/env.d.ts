/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

type Env = import('./types/database').Env;

declare namespace App {
  interface Locals {
    runtime?: {
      env: Env;
      cf?: IncomingRequestCfProperties;
      ctx?: ExecutionContext;
    };
    cfContext?: ExecutionContext;
  }
}
