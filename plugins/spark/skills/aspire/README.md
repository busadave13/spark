# Spark Plugin — `aspire` Skill

This skill is **reference-only documentation** about .NET Aspire (CLI, AppHost,
integrations, MCP server, dashboard, deployment). It is not part of the spark
spec-driven workflow and is not invoked by the orchestrator (`spark.agent.md`) or any
spark subagent.

It is loaded directly by the model when the user asks Aspire-related questions while
working in a project where Aspire is the orchestration layer. The orchestrator never
delegates to it.

If you are looking for the project-bootstrap skills, see:
- `plugins/spark/skills/dotnet-webapi-project/`
- `plugins/spark/skills/dotnet-blazor-project/`
