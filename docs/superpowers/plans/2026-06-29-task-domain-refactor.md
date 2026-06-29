# Task Domain Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Task management system to Clean Architecture, replacing the "fat" `task.service.ts` with isolated use cases and repositories, backed by comprehensive unit and integration tests.

**Architecture:** Clean Architecture (Entities $\rightarrow$ Use Cases $\rightarrow$ Adapters $\rightarrow$ Frameworks). Uses Dependency Inversion via Repository Interfaces.

**Tech Stack:** TypeScript, Express, Prisma, Vitest.

## Global Constraints

- All business logic must reside in Use Cases.
- Use Cases must have zero dependencies on Express or Prisma.
- Repositories must be injected into Use Cases via interfaces.
- 100% unit test coverage for business rules in Use Cases.
- Integration tests for all Repository methods.
- API tests for all Controllers.
- Follow SOLID, DRY, KISS, and SoC principles strictly.

---

## File Mapping

### Core (Domain & Application)

- **Entities:** `src/core/domain/entities/task.entity.ts` (Domain model and logic)
- **Repository Interfaces:** `src/core/domain/repositories/ITaskRepository.ts`
- **Use Cases:**
  - `src/core/application/use-cases/tasks/create-task.ts`
  - `src/core/application/use-cases/tasks/get-tasks.ts`
  - `src/core/application/use-cases/tasks/get-task.ts`
  - `src/core/application/use-cases/tasks/update-task.ts`
  - `src/core/application/use-cases/tasks/delete-task.ts`

### Infrastructure

- **Repositories:** `src/infrastructure/repositories/prisma-task.repository.ts`
- **Controllers:** `src/infrastructure/http/controllers/task.controller.ts`
- **Routes:** `src/infrastructure/http/routes/task.routes.ts`

### Tests

- **Unit:** `tests/unit/use-cases/tasks/*.test.ts`
- **Integration:** `tests/integration/repositories/prisma-task.repository.test.ts`
- **API:** `tests/api/tasks.test.ts`

---

## Implementation Tasks

### Task 1: Infrastructure Foundation

**Files:**

- Create: `src/core/domain/repositories/`, `src/core/application/use-cases/tasks/`, `src/infrastructure/repositories/`, `src/infrastructure/http/controllers/`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p src/core/domain/repositories src/core/application/use-cases/tasks src/infrastructure/repositories src/infrastructure/http/controllers
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "chore: setup clean architecture directory structure"
```

### Task 2: Task Domain Definition

**Files:**

- Create: `src/core/domain/entities/task.entity.ts`
- Create: `src/core/domain/repositories/ITaskRepository.ts`

**Interfaces:**

- Produces: `ITaskRepository` interface used by all Task Use Cases.

- [ ] **Step 1: Define the Task Entity** (Move relevant types from `task.service.ts` and Prisma to a domain entity).
- [ ] **Step 2: Define ITaskRepository interface** (Methods: `create`, `update`, `delete`, `findById`, `findWithRelations`, `getTasks`, `incrementTaskSequence`, `completeAllSubtasks`, `createTaskActivity`).
- [ ] **Step 3: Commit**

```bash
git add src/core/domain/
git commit -m "feat: define task domain entity and repository interface"
```

### Task 3: Prisma Task Repository Implementation

**Files:**

- Create: `src/infrastructure/repositories/prisma-task.repository.ts`
- Test: `tests/integration/repositories/prisma-task.repository.test.ts`

**Interfaces:**

- Consumes: `ITaskRepository` (implements)
- Produces: Concrete implementation of data access.

- [ ] **Step 1: Implement `PrismaTaskRepository`** (Move the Prisma logic from the old `task.repository.ts` into this class).
- [ ] **Step 2: Write integration tests** for each repository method.
- [ ] **Step 3: Run tests to verify implementation**

```bash
npx vitest tests/integration/repositories/prisma-task.repository.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/repositories/ tests/integration/
git commit -m "feat: implement prisma task repository with integration tests"
```

### Task 4: CreateTask Use Case (TDD)

**Files:**

- Create: `src/core/application/use-cases/tasks/create-task.ts`
- Test: `tests/unit/use-cases/tasks/create-task.test.ts`

**Interfaces:**

- Consumes: `ITaskRepository`
- Produces: `createTask(data: CreateTaskRequest): Promise<Task>`

- [ ] **Step 1: Write failing unit test** (Mock `ITaskRepository`, test successful creation and validation errors).
- [ ] **Step 2: Run test to verify it fails**.
- [ ] **Step 3: Implement `CreateTaskUseCase`** (Move logic from `taskService.createTask`, ensuring it uses the injected repository).
- [ ] **Step 4: Run test to verify it passes**.
- [ ] **Step 5: Commit**.

### Task 5: GetTasks Use Case (TDD)

**Files:**

- Create: `src/core/application/use-cases/tasks/get-tasks.ts`
- Test: `tests/unit/use-cases/tasks/get-tasks.test.ts`

**Interfaces:**

- Consumes: `ITaskRepository`
- Produces: `execute(query: GetTasksQuery, userId?: string): Promise<Task[]>`

- [ ] **Step 1: Write failing unit test** (Test filter parsing, admin vs user privacy logic).
- [ ] **Step 2: Run test to verify it fails**.
- [ ] **Step 3: Implement `GetTasksUseCase`** (Extract complex filter logic from `taskService.getTasks` into a separate helper if needed for KISS).
- [ ] **Step 4: Run test to verify it passes**.
- [ ] **Step 5: Commit**.

### Task 6: GetTask Use Case (TDD)

**Files:**

- Create: `src/core/application/use-cases/tasks/get-task.ts`
- Test: `tests/unit/use-cases/tasks/get-task.test.ts`

**Interfaces:**

- Consumes: `ITaskRepository`, `IMediaService` (Interface)
- Produces: `execute(taskId: string, userId?: string): Promise<TaskWithAttachments>`

- [ ] **Step 1: Write failing unit test** (Test not found, forbidden privacy, and successful retrieval).
- [ ] **Step 2: Run test to verify it fails**.
- [ ] **Step 3: Implement `GetTaskUseCase`**.
- [ ] **Step 4: Run test to verify it passes**.
- [ ] **Step 5: Commit**.

### Task 7: UpdateTask Use Case (TDD)

**Files:**

- Create: `src/core/application/use-cases/tasks/update-task.ts`
- Test: `tests/unit/use-cases/tasks/update-task.test.ts`

**Interfaces:**

- Consumes: `ITaskRepository`, `IWorkflowService`, `INotificationService`, `IAutomationService` (All Interfaces)
- Produces: `execute(taskId: string, userId: string, data: UpdateTaskRequest): Promise<Task>`

- [ ] **Step 1: Write failing unit test** (Test status transition validation, auditing, and subtask completion).
- [ ] **Step 2: Run test to verify it fails**.
- [ ] **Step 3: Implement `UpdateTaskUseCase`** (Split the massive `updateTask` logic into small private methods for auditing and validation to maintain Low Coupling).
- [ ] **Step 4: Run test to verify it passes**.
- [ ] **Step 5: Commit**.

### Task 8: DeleteTask Use Case (TDD)

**Files:**

- Create: `src/core/application/use-cases/tasks/delete-task.ts`
- Test: `tests/unit/use-cases/tasks/delete-task.test.ts`

**Interfaces:**

- Consumes: `ITaskRepository`
- Produces: `execute(taskId: string, userId: string): Promise<void>`

- [ ] **Step 1: Write failing unit test**.
- [ ] **Step 2: Run test to verify it fails**.
- [ ] **Step 3: Implement `DeleteTaskUseCase`**.
- [ ] **Step 4: Run test to verify it passes**.
- [ ] **Step 5: Commit**.

### Task 9: Wiring the HTTP Layer

**Files:**

- Create: `src/infrastructure/http/controllers/task.controller.ts`
- Modify: `src/infrastructure/http/routes/task.routes.ts` (or `src/routes/v1/task.routes.ts`)
- Modify: `src/app/services/task.service.ts` (Delete after wiring)

- [ ] **Step 1: Implement `TaskController`** (Inject all Task Use Cases and map HTTP requests $\rightarrow$ Use Case calls).
- [ ] **Step 2: Update routes** to use `TaskController`.
- [ ] **Step 3: Run API tests** using `supertest` to ensure the endpoints still work exactly as before.
- [ ] **Step 4: Remove `src/app/services/task.service.ts`**.
- [ ] **Step 5: Commit**.
