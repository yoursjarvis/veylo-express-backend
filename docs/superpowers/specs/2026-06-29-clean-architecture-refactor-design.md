# Design Spec: Refactoring to Clean Architecture

**Date:** 2026-06-29
**Status:** Proposed
**Topic:** Backend Refactor for Scalability and Maintainability

## 1. Overview

The current backend architecture utilizes a standard Layered Architecture (Routes $\rightarrow$ Services $\rightarrow$ Repositories). As the application grows, the service layer has become "fat," mixing business logic, validation, orchestration, and auditing. This design proposes a transition to **Clean Architecture** to ensure the codebase remains maintainable, testable, and decoupled as it scales from the current 10% feature completion to 100%.

## 2. Core Principles

This refactor is guided by:

- **SOLID:** Especially the Single Responsibility Principle (SRP) and Dependency Inversion Principle (DIP).
- **DRY (Don't Repeat Yourself):** Extracting common logic into shared utilities and base classes.
- **KISS (Keep It Simple, Stupid):** Avoiding over-engineering while maintaining strict boundaries.
- **Separation of Concerns (SoC):** Separating how a request is received (HTTP) from how business rules are applied (Use Cases) and how data is stored (Prisma).
- **High Cohesion / Low Coupling:** Grouping related logic together and minimizing dependencies between different domains.

## 3. Architecture Layers

### 3.1 Entities (The Core)

- **Purpose:** Enterprise business rules.
- **Contents:** Data models and methods that are fundamental to the business, regardless of the application's specific use cases.
- **Dependencies:** None.

### 3.2 Application Layer (Use Cases)

- **Purpose:** Application-specific business rules.
- **Contents:** Small, single-purpose classes (Interactors) that execute one specific action (e.g., `CreateTaskUseCase`).
- **Dependencies:** Only depends on Entities and Repository Interfaces.

### 3.3 Interface Adapters

- **Controllers:** Convert HTTP requests into Use Case inputs and Use Case outputs into HTTP responses.
- **Repositories (Implementations):** Concrete classes that implement the Repository Interfaces using Prisma.
- **Dependencies:** Depends on the Application Layer.

### 3.4 Frameworks & Drivers

- **External Tools:** Express.js, Prisma, Redis, Postgres, Mail services.
- **Dependencies:** All other layers.

## 4. Folder Structure

```text
src/
├── core/                        # Business Logic Center
│   ├── domain/                   # Entities and Interfaces
│   │   ├── entities/             # Core domain models
│   │   └── repositories/        # IRepository interfaces (e.g., ITaskRepository.ts)
│   └── application/              # Use Cases
│       └── use-cases/            # Single-responsibility a-service logic
│           └── tasks/            # Task-related use cases
│               ├── create-task.ts
│               ├── update-task.ts
│               └── get-task.ts
├── infrastructure/              # Framework-specific code
│   ├── repositories/             # Concrete Prisma implementations
│   │   └── prisma-task.repository.ts
│   ├── http/                    # Express delivery mechanism
│   │   ├── controllers/          # Request/Response mapping
│   │   │   └── task.controller.ts
│   │   └── routes/              # Route definitions
│   └── config/                  # Infrastructure configuration
└── shared/                      # Cross-cutting concerns
    ├── errors/                  # AppError, BadRequestException, etc.
    ├── utils/                   # Generic helpers
    └── logger/                  # Centralized logging
```

## 5. Dependency Inversion Strategy

To achieve high testability, we will use **Dependency Injection**. Use cases will not instantiate repositories directly.

**Example Flow:**

1. `ITaskRepository` (Interface) $\rightarrow$ Defined in `core/domain/repositories`.
2. `CreateTaskUseCase` (Application) $\rightarrow$ Accepts `ITaskRepository` in its constructor.
3. `PrismaTaskRepository` (Infrastructure) $\rightarrow$ Implements `ITaskRepository`.
4. **Wiring:** The controller (or a dependency injection container) injects the `PrismaTaskRepository` instance into the `CreateTaskUseCase`.

## 6. Testing Strategy (The Confidence Pyramid)

### 6.1 Unit Tests (Highest Volume)

- **Target:** Use Cases and Entities.
- **Mocking:** All Repository interfaces are mocked.
- **Goal:** 100% coverage of business rules and edge cases.

### 6.2 Integration Tests (Moderate Volume)

- **Target:** Repository implementations.
- **Method:** Real database (Test Container).
- **Goal:** Verify Prisma queries and DB constraints.

### 6.3 API / E2E Tests (Lowest Volume, Critical Paths)

- **Target:** Full request-response cycle.
- **Method:** `supertest` hitting endpoints.
- **Goal:** Verify the "wiring" of the entire system.

## 7. Migration Path

Since the app is at 10% completion, we will use an **Incremental Refactor** approach:

1. **New Features:** All new features will be built using the Clean Architecture pattern.
2. **Existing Features:** We will refactor the current "Fat Services" one by one.
   - Identify a use case (e.g., `createTask`).
   - Extract logic to a new Use Case class.
   - Create the corresponding Repository interface.
   - Move Prisma code to a concrete Repository implementation.
   - Update the Controller to use the Use Case.
   - Write Unit and Integration tests for the new structure.
3. **Deprecation:** Once all methods in a "Fat Service" are moved to Use Cases, the service file is deleted.
