# Architecture

Pict-Cruisecontrol is composed of Fable services (the workflow engine, the state manager, and the step/assertion base classes) and Pict views (the navigation layer). This page documents each class, the workflow lifecycle, and the persistence model, and marks every part that currently ships as a stub.

## Module Map

| File | Class | Kind | Role |
|------|-------|------|------|
| `Pict-CruiseControl.js` | `FableCruiseControl` | Fable service | The workflow engine. Service type `CruiseControl`. |
| `Pict-CruiseControl-BrowserStateManagement.js` | `FableCruiseControlBrowserStateManagement` | Fable service | Persists the current workflow to `localStorage`. |
| `Pict-CruiseControl-Feature.js` | `PictCruiseControl` | Pict view | Hosts the two navigation child views. Package `main`. |
| `Pict-View-CruiseControl-LocationDetection.js` | `PictCruiseControlLocationDetection` | Pict view | Page/location detection. **Stub.** |
| `Pict-View-CruiseControl-NavigationPilot.js` | `PictCruiseControlNavigationPilot` | Pict view | Navigation and actions. **Stub.** |
| `workflow/Workflow-Step.js` | `WorkflowStep` | Fable service | Base class for a workflow step. |
| `workflow/Generic-Step-Wait.js` | `WorkflowStep` (subclass) | Fable service | Built-in `Wait` step. |
| `assert/Assert-Condition.js` | `AssertCondition` | Fable service | Base class for an assertion. |
| `assert/Assert-Element-Exists.js` | `AssertCondition` (subclass) | Fable service | Built-in `ElementExists` assertion. |
| `assert/Assert-Title-Contains.js` | `AssertCondition` (subclass) | Fable service | Built-in `TitleContains` assertion. |

The package `main` is `Pict-CruiseControl-Feature.js` (the view), but `Pict-CruiseControl.js` re-exports the engine, the base classes, and the state manager:

```javascript
module.exports = FableCruiseControl;
module.exports.WorkflowStep = libWorkflowStep;
module.exports.AssertCondition = libAssertCondition;
module.exports.BrowserStateManagement = require('./Pict-CruiseControl-BrowserStateManagement.js');
```

## The Workflow Engine &mdash; `FableCruiseControl`

The engine extends `fable-serviceproviderbase` and sets `serviceType = 'CruiseControl'`. On construction it registers the `AssertCondition` and `WorkflowStep` service types (via `addServiceTypeIfNotExists`), then seeds the built-ins:

- `workflowSteps.Wait` &mdash; the generic wait step
- `workflowAssertions.TitleContains` and `workflowAssertions.ElementExists`

It also aliases `this.pict = this.fable` for convenience.

### Methods

| Method | Purpose |
|--------|---------|
| `addAssertion(pAssertionHash, pAssertionPrototype)` | Instantiate `pAssertionPrototype` as an `AssertCondition` service and store it on `workflowAssertions[pAssertionHash]`. Warns and overwrites on a duplicate hash. |
| `addWorkflowStep(pStepHash, pStepPrototype)` | Instantiate `pStepPrototype` as a `WorkflowStep` service and store it on `workflowSteps[pStepHash]`. Warns and overwrites on a duplicate hash. |
| `startWorkflow(pWorkflowStep, fCallback)` | Reset the workflow, load the stored workflow, initialize its state, set step state to `Inactive`, and begin executing at the step hash `pWorkflowStep`. |
| `initializeWorkflowState(pWorkflowState)` | Load the stored workflow and assign `pWorkflowState` to `CurrentWorkflow.State`. |
| `checkAndExecuteWorkflow(fCallback)` | Resume an active stored workflow: if it is active and its current step status is `NotRun`, execute the current step. |
| `setStepState(pStepState)` | Set `CurrentWorkflow.State` and persist via `storeCurrentWorkflow()`. |
| `executeWorkflowStep(fCallback, pWorkflowStep)` | The core driver. Runs the step's lifecycle and chains to the next step. |

### State Storage Dependency

The engine does not hold its own state. It reads and writes the current workflow through `this.fable.services.CruiseControlStateManagement` &mdash; for example `resetWorkflow()`, `getStoredWorkflow()`, and `storeCurrentWorkflow()`. The state manager must therefore be registered under the service hash **`CruiseControlStateManagement`** before a workflow is started. (The [Quickstart](quickstart.md) shows this registration.)

## The Step Lifecycle

`executeWorkflowStep` is re-entrant: it advances the step's `State` through a series of phases, re-invoking itself as it goes. For a single step the engine drives this sequence:

1. **`Inactive` &rarr; pre-execution.** Sets state `PreExecution`, calls the step's `onBeforeExecuteStep(fNext)`.
2. **Execution.** Sets state `Executing`, calls the step's `onExecuteStep(...)`.
3. **`Executing` &rarr; post-execution.** Sets state `PostExecution`, calls the step's `onAfterExecuteStep(fNext)`.
4. **Optional wait.** If `nextStepDelay > 0`, sets state `Waiting`, waits that many milliseconds (then `CheckingPostAssertions`).
5. **Advance.** Sets state `Completed`. If the step has a `nextStepHash`, resets to `Inactive` and executes the next step; otherwise the workflow is complete.

State transitions are written to storage at each phase (through `setStepState`), which is what lets a workflow be picked up again with `checkAndExecuteWorkflow` after the page reloads.

> **Note:** the engine source contains a commented-out block intended to evaluate a step's `nextStepAssertions` after execution and retry on failure. That post-step assertion/retry loop is **not active** in the current code. The `WorkflowStep` base class does, however, define the configuration fields it would use (see below).

## Workflow Steps &mdash; `WorkflowStep`

The base class (service type `WorkflowStep`) defines a step's identity, its lifecycle hooks, and a set of configuration fields. Subclass it and override the hooks.

### Lifecycle hooks

| Hook | Default behavior |
|------|------------------|
| `onBeforeExecuteStep(fCallback)` | Calls `fCallback()` (no-op). |
| `onExecuteStep(fCallback)` | Logs an "is not implemented" error and calls `fCallback()`. **Override this.** |
| `onAfterExecuteStep(fCallback)` | Calls `fCallback()` (no-op). |

### Configuration fields (constructor defaults)

| Field | Default | Meaning |
|-------|---------|---------|
| `stepName` | `'Undefined Workflow Step'` | Human-readable name (used in logs). |
| `stepHash` | `'Undefined-Workflow-Step'` | Identifying hash. |
| `nextStepHash` | `false` | Hash of the next step, or `false` to end the workflow. |
| `nextStepDelay` | `0` | Milliseconds to wait after this step before advancing. |
| `nextStepAssertions` | `[]` | Assertions for the (currently inactive) post-step retry loop. |
| `nextStepAssertionState` | `{}` | State object for those assertions. |
| `nextStepRetryDelay` | `10` | Retry delay (ms) for the post-step loop. |
| `nextStepRetryCount` | `10000` | Retry count for the post-step loop. |
| `beforeStartAssertions` | `[]` | Assertions intended to gate the start of the step. |
| `beforeStartAssertionState` | `{}` | State object for those assertions. |
| `beforeStartDelay` | `0` | Delay (ms) before the step starts. |
| `beforeStartRetryDelay` | `10` | Retry delay (ms) for the before-start gate. |
| `beforeStartRetryCount` | `10000` | Retry count for the before-start gate. |

> The `beforeStart*` and `nextStepAssertions`/retry fields are defined on the base class, but the engine's current execution path only acts on `nextStepHash` and `nextStepDelay`. The assertion-gating and retry fields are scaffolding for future behavior.

### The built-in `Wait` step

`Generic-Step-Wait.js` overrides `onExecuteStep` to wait `AppData.CurrentWorkflowStep.WaitDuration` milliseconds via `setTimeout`, then call the callback. If no `WaitDuration` is set it logs an error and defaults to `100` ms. It sets `stepName = 'Generic Wait'`.

## Assertions &mdash; `AssertCondition`

The base class (service type `AssertCondition`) defines `conditionName`, `conditionHash`, and one method:

| Method | Default behavior |
|--------|------------------|
| `assertCondition(pConditionDataObject)` | Logs an "is not implemented" error and returns `false`. **Override this** to return a boolean. |

### Built-in assertions

| Hash | Reads | Returns true when |
|------|-------|-------------------|
| `ElementExists` | `pConditionDataObject.ElementAddress` | `this.pict.ContentAssignment.getElement(ElementAddress)` matches at least one element. |
| `TitleContains` | `pConditionDataObject.Text` | The page `<title>` text contains the substring. Uses `window.jQuery('title')`, so jQuery must be present. |

> **Note on `TitleContains`:** in source its `conditionName` / `conditionHash` are left at the base-class defaults (`'Undefined Assert Condition'` / `'Undefined-Assert-Condition'`); the engine still registers it under the hash `TitleContains` because the hash comes from the `addAssertion` call, not the class fields.

## The Navigation View Layer

### `PictCruiseControl` (package `main`)

A `pict-view` that, on construction, creates two child views bound to the host Pict instance:

```javascript
this.LocationDetection = this.pict.addView(`LocationDetection-${this.UUID}`, libLocationDetection.default_configuration, libLocationDetection);
this.NavigationPilot   = this.pict.addView(`NavigationPilot-${this.UUID}`,  libNavigationPilot.default_configuration,  libNavigationPilot);
```

Its `default_configuration` is a standard Pict view configuration (`ViewIdentifier: 'PictCruiseControl'`, auto-initialize/render/solve, an empty placeholder template). The view is the intended composition root for the detection and navigation seams below.

### `LocationDetection` &mdash; stub

`PictCruiseControlLocationDetection` extends `pict-view`. Its three methods are extension points and currently return `false`:

| Method | Intent (per source comments) | Current behavior |
|--------|------------------------------|------------------|
| `isAtSite()` | Detect whether the DOM has the site loaded. | Returns `false`. |
| `isAtLocation(pLocationHash)` | Detect whether a specific location is loaded into the DOM. | Returns `false`. |
| `inferLocation()` | Infer the current location(s) loaded into the DOM. | Returns `false`. |

### `NavigationPilot` &mdash; stub

`PictCruiseControlNavigationPilot` extends `pict-view`. Its methods are extension points and are not yet implemented:

| Method | Intent (per source comments) | Current behavior |
|--------|------------------------------|------------------|
| `navigateTo(pLocationHash, pLocationScope)` | Navigate to a specific location; optional scope object carries data (e.g. identifiers). | Returns `false`. |
| `performAction(pActionHash, pActionScope)` | Perform an action; optional scope object carries action state. | Empty body (no-op). |

A consuming application supplies the real behavior by subclassing or overriding these views with site-specific logic.

## State Management &mdash; `FableCruiseControlBrowserStateManagement`

This service (exported as `BrowserStateManagement`) owns the workflow object and its persistence. It is configured with a `DefaultWorkflowState` and reads/writes the browser `localStorage` key **`PictCruiseControlWorkflow`**.

### The default workflow state

```javascript
{
	Active: false,
	CurrentWorkflowName: 'No active workflow.',
	CurrentWorkflowStep: 'Inactive',
	CurrentWorkflowStepName: 'No active workflow.',
	CurrentWorkflowStepStatus: 'NotRun',
	CurrentWorkflowStepExitRetryCount: 0
}
```

`createNewWorkflow()` returns a deep clone of this object. The live workflow is held at `pict.AppData.CurrentWorkflow`.

### Methods

| Method | Purpose |
|--------|---------|
| `createNewWorkflow()` | Return a fresh deep clone of `DefaultWorkflowState`. |
| `resetWorkflow()` | Set `AppData.CurrentWorkflow` to a new workflow and delete the stored copy. |
| `validateCurrentWorkflowForStorage()` | Validation hook; currently always returns `true`. |
| `storeCurrentWorkflow()` | Write `AppData.CurrentWorkflow` as JSON to `localStorage`. |
| `getStoredWorkflow()` | Read and parse the stored workflow into `AppData.CurrentWorkflow`; on parse error or absence, reset. |
| `deleteStoredWorkflow()` | Remove the `localStorage` key. |

This `localStorage` round-trip is the mechanism that lets a workflow survive a full page navigation: each state transition is stored, and the engine's `checkAndExecuteWorkflow` can reload and resume it after the new page loads.

## Configuration Schema (Reference)

The module's test fixture, `test/Pict-CruiseControl-Configuration.json`, is a worked example of the kind of site description Cruise Control is designed around &mdash; a "Bookstore" site with page-detection criteria, named locations, navigation routes, actions, and a data schema.

> **Scope note:** this JSON is a test fixture / design reference. The current engine code drives `WorkflowStep` chains and `AssertCondition` checks; it does not contain a loader that consumes this whole document. Treat the schema below as the intended shape of a site configuration, not as a format the shipped engine parses end-to-end. The navigation/detection seams that would act on it (`NavigationPilot`, `LocationDetection`) are the stubs documented above.

The fixture's top-level keys:

| Key | Contents |
|-----|----------|
| `Name`, `Description`, `Site`, `URL` | Identity of the site under automation. |
| `Criteria` | Site-level page-detection criteria (e.g. require the `title` to contain `"Retold Bookstore"`). |
| `Locations` | Named locations within the site, each with its own `Criteria` and a `GUIDLocation`. |
| `NavigationRoutes` | How to reach locations &mdash; by `URL`, `HashURL`, or `Click` (with an `Address`). |
| `Actions` | Named actions, e.g. a `RecordMarshall` against a `Schema`. |
| `Schemas` | Data schemas to marshal from the page, with descriptors that map fields to a `PageAddress`. |

A single criterion is shaped like:

```json
{
	"Expectation": "Require",
	"Address": "title",
	"Comparison": "contains",
	"ValueType": "static string",
	"Value": "Retold Bookstore"
}
```

`Comparison` values seen in the fixture include `contains`, `ends with`, and `dom element exists`; `ValueType` values include `static string` and `manifest address`; `Expectation` values include `Require` and `Maybe`.

## Testing

The committed tests (`test/Pict-CruiseControl_tests.js` and `test/Pict-CruiseControl_Complex_tests.js`) are Quackage view-construction boilerplate: they instantiate the `main` view against a mock Pict and assert basic construction/initialization. They do not exercise the workflow engine, the steps, or the assertions. Run them with:

```bash
npm test
```
