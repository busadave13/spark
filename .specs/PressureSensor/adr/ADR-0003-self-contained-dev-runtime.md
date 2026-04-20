<!-- SPARK -->
# ADR-0003: Operate as a Self-Contained Development Runtime

> **Version**: 1.0<br>
> **Created**: 2026-04-15<br>
> **Last Updated**: 2026-04-15<br>
> **Owner**: Dave Harding<br>
> **Project**: Pressure Sensor<br>
> **Status**: Approved

---

## 1. Context

Pressure Sensor Service is intended for local and cloud development environments where dependent services need a pressure-data source. The PRD explicitly prohibits external dependencies — no external pressure providers, no hardware sensors, no required infrastructure beyond the runtime itself. The development experience must allow a developer to clone the repository, run the service, and get working pressure responses immediately without provisioning databases, storage accounts, or network resources. The runtime model also determines how the service integrates with the Aspire AppHost that orchestrates the test service portfolio.

---

## 2. Decision

> We will run Pressure Sensor Service as a self-contained ASP.NET Core process with no external dependencies, registered in the Aspire AppHost as a standalone project with no resource references. Health and readiness endpoints will provide operational verification without external health checks.

---

## 3. Rationale

A self-contained runtime eliminates setup friction — `dotnet run` is the only command needed to start the service. No database migrations, no storage emulators, no connection strings. The Aspire AppHost registers the service as a standalone project (like the sibling TemperatureSensor), which means Aspire manages the process lifecycle but does not need to provision or inject any resources. Health (`/healthz`) and readiness (`/readyz`) endpoints let Aspire and developers verify the service is running and its mock dataset is accessible, without requiring external monitoring infrastructure. This matches the PRD's constraint that the service must not require any external system to return data.

---

## 4. Alternatives Considered

### Aspire with Azure Blob Storage (Emulated)
**Why rejected:** The sibling Mockery project uses blob storage because its design requires cloud-backed mock storage. Pressure Sensor Service has a simpler scope — its mock data is a small, static, file-based dataset. Adding an emulated blob storage dependency would increase startup time, require the Azurite emulator, and add configuration complexity with no functional benefit. The PRD explicitly requires no external dependencies.

### Docker Compose with External Services
**Why rejected:** A Docker Compose setup with databases or message queues would contradict the self-contained constraint. It would also diverge from the Aspire-based orchestration model used across the test service portfolio and require developers to install and manage Docker for a service that needs nothing beyond the .NET runtime.

---

## 5. Consequences

### Positive Consequences
- Zero-setup developer experience — clone, `dotnet run`, and the service is operational with working pressure responses.
- No infrastructure provisioning required for local or Aspire-orchestrated development scenarios.
- Health and readiness endpoints provide built-in operational verification without external monitoring tools.
- Consistent with the TemperatureSensor sibling project's integration model in the Aspire AppHost.

### Trade-offs Accepted
- The service cannot demonstrate cloud-native patterns (managed storage, service discovery, distributed tracing) because it intentionally avoids external dependencies. If these patterns are needed in the future, the architecture must be revisited.
- Without external storage, there is no shared state between multiple instances of the service. This is acceptable because the service is not designed for horizontal scaling or multi-instance deployment.

---

*This ADR is part of the [Architecture Decision Records index](README.md).*
