import { Body, Controller, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { limits } from "./limits.js";

// The three measured routes stay free of pipes, guards and interceptors, so the numbers
// compare the adapters and not anything layered on top of them.
@Controller()
export class BenchController {
  readonly #host: HttpAdapterHost;

  constructor(@Inject(HttpAdapterHost) host: HttpAdapterHost) {
    this.#host = host;
  }

  @Get()
  root(): { hello: string } {
    return { hello: "world" };
  }

  @Get("users/:id")
  user(@Param("id") id: string): { id: string } {
    return { id };
  }

  @Post("echo")
  @HttpCode(200)
  echo(@Body() body: unknown): unknown {
    return body;
  }

  // Not measured. The runner waits on it, and the adapter names itself here, so a container
  // that booted the wrong adapter can't pass as the right one.
  @Get("health")
  health(): {
    status: "ok";
    adapter: string;
    node: string;
    cpus: number | null;
    memoryBytes: number | null;
  } {
    return {
      status: "ok",
      adapter: this.#host.httpAdapter.getType(),
      node: process.version,
      ...limits,
    };
  }
}
