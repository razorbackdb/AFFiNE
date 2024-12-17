This document explains how to start server (@affine/server) locally with Docker

> **Warning**:
>
> This document is not guaranteed to be up-to-date.
> If you find any outdated information, please feel free to open an issue or submit a PR.

## Run required dev services in docker compose

```sh
cp ./.docker/dev/compose.yml.example ./.docker/dev/compose.yml
cp ./.docker/dev/.env.example ./.docker/dev/.env

docker compose -f ./.docker/dev/compose.yml up -d
```

## Build native packages (you need to setup rust toolchain first)

```sh
# build native
yarn affine @affine/server-native build
```

## Prepare dev environment

```sh
cd packages/backend/server

# uncomment all env variables here
cp .env.example .env
yarn prisma db push
yarn data-migration run
```

## Start server

```sh
yarn dev
```

when server started, it will created a default user for testing:

- email: dev@affine.pro
- name: Dev User
- password: dev

## Start frontend

```sh
# at project root
yarn dev
```

## Done

Now you should be able to start developing affine with server enabled.

## Bonus

### Enable prisma studio (Database GUI)

```sh
# available at http://localhost:5555
yarn prisma studio
```
