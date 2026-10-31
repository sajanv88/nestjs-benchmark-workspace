# NestJS adapter benchmark

A live benchmark of three NestJS HTTP adapters, charted with [nuvui](https://nuvui.nuvraxis.com/docs). It runs on one machine and has nothing to deploy.

Author: sajanv88

> [!WARNING]
> The runner executes load tests on request and has no authentication. Out of the box, Compose publishes it on `127.0.0.1` only, and it refuses other hosts and origins. You're free to change that, but exposing it publicly isn't recommended: anyone who can reach it can start load tests on your machine. If you do, it's at your own risk.

## Run it

You need Docker with Compose, Node 26 and pnpm.

```sh
pnpm install
docker compose up -d --build --wait   # the three apps and the runner
pnpm dev                              # the page
```

Open <http://localhost:3000> and press **Run benchmark**. A full run takes about 5 minutes and uses the machine hard, so close anything heavy first. **Stop** ends it in about a second.

When you're finished, stop `pnpm dev` and run `docker compose down`.

## What it measures

Nest + Express, Nest + Fastify and Nest + Node serve the same three routes: `GET /`, `GET /users/:id` and `POST /echo`. They are one app in one Docker image, and an environment variable picks the adapter. Each app gets 1 CPU and 512 MB.

The shape follows [nestjs/nest#18063](https://github.com/nestjs/nest/pull/18063), which uses `wrk -t4 -c100`, with [autocannon](https://github.com/mcollina/autocannon) as the load generator: 100 connections, 3 s of warm-up and 8 s measured for each route. Only one adapter and route run at a time. Three rounds give one median for each pair.

## Reading the numbers

- **They're relative to this machine.** They aren't comparable to the PR's M1 Pro results, or to another computer.
- **Read the order, not the exact ratio.** The order held in every run here. The size of the lead didn't: with the same 100 connections split across two load generators, Node's lead over Fastify on `GET /` fell from +54% to +6%.
- **Expect noise.** A single figure can move by about 10% between runs.

## Saved results

A run that completes writes `results/latest.json`, replacing the one before. A stopped or failed run writes nothing. The file is ignored by git, so a fresh clone starts empty. The page shows the saved run when the runner is down.

On Linux, the runner's user (uid 1001) needs write access to `results/`:

```sh
sudo chown 1001 results
```

## Without the page

This prints the result as JSON and doesn't touch the saved file. Progress goes to stderr.

```sh
docker compose run --rm -T runner node dist/cli.js --rounds 1 --warmup 1 --measure 2 > run.json
```

## Layout

| Path | What it is |
| --- | --- |
| `apps/bench-app` | The NestJS app under test |
| `apps/runner` | Drives autocannon, and serves `POST /run`, `POST /stop` and `GET /events` (SSE) |
| `apps/web` | The Next.js page. It talks only to the runner |
| `packages/types` | The event and result schemas shared by the runner and the page |

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm build
```
