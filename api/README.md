AuditBrain API
==============

Provides an API that allows the chat UI for AuditBrain to feed user messages and data from Elasticsearch to OpenAI for the purpose of delivering intelligent and helpful responses.

## Prerequisites

- Git
- Docker

## Installation

```sh
make
```

or

```sh
make install
```

## Crawl AuditBoard Resources To Build Index

1. Sign in to support.soxhub.com
2. Retrieve the value for the cookie named `_zendesk_shared_session` and set it as the value for `KNOWLEDGE_BASE_SESSION_TOKEN` in the `.env` file.
3. Sign in to academy.auditboard.com
4. Retrieve the value for the cookie named `sj_sessionid` and set it as the value for `ACADEMY_SESSION_TOKEN` in the `.env` file.
5. Run `make index` to start the indexing process.
6. Wait an extremely long amount of time.

This will add a `data/indexer-state.json` file that keeps track of the current progress of the indexer.  If the indexer crashes, it should be possible for it to resume from where it left off based on that file.


## Start Server

```sh
make serve
```

## Start Daemonized Server

```sh
make up
```

## Spin Down Services

```sh
make down
```
