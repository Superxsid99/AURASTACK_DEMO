# Phase 2 deployment path (GCP + Vertex)

This directory contains baseline manifests for deploying the API, worker, and ADK agent service to Cloud Run.

## Services

- `cloudrun-api.yaml`: public API + socket gateway
- `cloudrun-worker.yaml`: BullMQ worker that drains intake jobs
- `cloudrun-agents.yaml`: Python ADK runtime service

## Required secrets

- `api-database-url`
- `api-jwt-secret`
- `internal-worker-token`

## Deploy order

1. Deploy `smart-case-buddy-agents`
2. Deploy `smart-case-buddy-api`
3. Deploy `smart-case-buddy-worker`

## Vertex-first alignment

The ADK service is deployment-ready for Vertex-backed execution:

- Set `GOOGLE_GENAI_USE_VERTEXAI=true`
- Set `GOOGLE_CLOUD_PROJECT`
- Set `GOOGLE_CLOUD_LOCATION`

For Agent Engine runtime concepts and deployment guidance, follow:

- [Vertex ADK overview](https://docs.cloud.google.com/agent-builder/agent-development-kit/overview)
- [ADK docs](https://google.github.io/adk-docs/)
