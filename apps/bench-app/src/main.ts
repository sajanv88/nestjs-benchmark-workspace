import "reflect-metadata";
import type { INestApplication, NestApplicationOptions } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { env } from "./env.js";

// Request logging off for every adapter; each one otherwise runs on its defaults.
const options: NestApplicationOptions = { logger: ["error", "warn"] };

// Imported on demand so a container only ever loads the adapter it serves.
async function createApp(): Promise<INestApplication> {
  switch (env.BENCH_ADAPTER) {
    case "express": {
      const { ExpressAdapter } = await import("@nestjs/platform-express");
      return NestFactory.create(AppModule, new ExpressAdapter(), options);
    }
    case "fastify": {
      const { FastifyAdapter } = await import("@nestjs/platform-fastify");
      return NestFactory.create(AppModule, new FastifyAdapter(), options);
    }
    case "node": {
      const { NodeAdapter } = await import("@nestjs/platform-node");
      return NestFactory.create(AppModule, new NodeAdapter(), options);
    }
  }
}

const app = await createApp();
app.enableShutdownHooks();
await app.listen(env.PORT, "0.0.0.0");
process.stdout.write(`bench-app: ${env.BENCH_ADAPTER} listening on ${env.PORT}\n`);
