import type { FlowForgeNodeType } from "./types";

export interface WorkflowPaletteDocSectionItem {
  label: string;
  description: string;
}

export interface WorkflowPaletteDocExample {
  title: string;
  body: string;
}

export interface WorkflowPaletteDoc {
  type: FlowForgeNodeType;
  title: string;
  summary: string;
  bestFor: string[];
  inputs: WorkflowPaletteDocSectionItem[];
  outputs: WorkflowPaletteDocSectionItem[];
  examples: WorkflowPaletteDocExample[];
  tips: string[];
}

export const WORKFLOW_PALETTE_DOCS: Partial<Record<FlowForgeNodeType, WorkflowPaletteDoc>> = {
  manual_start: {
    type: "manual_start",
    title: "Manual Start",
    summary:
      "Use Manual Start when a workflow should begin only after a person decides it is time to run it. It is the easiest starter for testing, one-off work, and processes that need a human checkpoint before anything happens.",
    bestFor: [
      "Testing a workflow before it is connected to a schedule, webhook, or file watch.",
      "Starting a one-time operational process, such as a weekly review or cleanup run.",
      "Keeping a workflow quiet until an operator chooses Run now.",
    ],
    inputs: [
      {
        label: "A person clicks Run now",
        description:
          "The workflow waits until an authorized person starts it from Workflow Studio or another approved run screen.",
      },
      {
        label: "The selected workflow version",
        description:
          "Manual Start runs the saved version that is available for the workflow. If the design has unsaved changes, save a draft first so the run uses what you see.",
      },
      {
        label: "Run context",
        description:
          "The run carries basic start details forward, such as the fact that it was started manually and when the run began.",
      },
    ],
    outputs: [
      {
        label: "A new workflow run",
        description:
          "Manual Start creates the run and moves it to the next connected step.",
      },
      {
        label: "Start details for later steps",
        description:
          "Downstream steps can use the run context to know that the workflow began manually.",
      },
      {
        label: "Run history",
        description:
          "The start is recorded in the workflow run timeline so operators can see when the process began.",
      },
    ],
    examples: [
      {
        title: "Try a new workflow safely",
        body:
          "Build the workflow, save a draft, then click Run now. Manual Start lets you confirm the path works before connecting it to live incoming events.",
      },
      {
        title: "Run a weekly review on demand",
        body:
          "A coordinator opens the workflow every Friday, clicks Run now, and the next step gathers the records or tasks that need attention.",
      },
    ],
    tips: [
      "Use one starter at the beginning of the workflow. Manual Start should usually be the first node.",
      "When a workflow should run by itself later, replace Manual Start with a Schedule Trigger, Webhook Trigger, or File Watch Trigger.",
      "Manual Start does not collect form answers by itself. Add a Human Task or Capture Event when you need someone to provide details.",
    ],
  },
  schedule_trigger: {
    type: "schedule_trigger",
    title: "Schedule Trigger",
    summary:
      "Use Schedule Trigger when a workflow should start automatically on an approved recurring schedule, such as every morning, every Friday, or once a month.",
    bestFor: [
      "Running regular reviews, reminders, exports, or cleanup steps without someone pressing Run now.",
      "Keeping recurring work consistent across teams and time periods.",
      "Starting a workflow at a predictable time after the design has been saved and approved.",
    ],
    inputs: [
      { label: "Approved schedule", description: "The repeat pattern that tells the workflow when it is allowed to start." },
      { label: "Saved workflow version", description: "The workflow version that should run when the scheduled time arrives." },
      { label: "Schedule context", description: "Basic timing details, such as the scheduled start time and trigger mode." },
    ],
    outputs: [
      { label: "A scheduled workflow run", description: "The trigger creates a new run when the schedule is due." },
      { label: "Schedule details", description: "Later steps can see that the workflow started from a schedule." },
      { label: "Run history", description: "The scheduled start is visible in the run timeline." },
    ],
    examples: [
      { title: "Daily work queue", body: "Start each morning by gathering records that need review and sending them to the right team." },
      { title: "Weekly export", body: "Run every Friday afternoon, prepare a governed extract, and send it to an approved destination." },
    ],
    tips: [
      "Use Schedule Trigger when the work should happen without a person starting it.",
      "Use Manual Start while testing, then switch to Schedule Trigger when the timing is ready.",
      "Keep schedules tied to saved workflow versions so runs are predictable.",
    ],
  },
  webhook_trigger: {
    type: "webhook_trigger",
    title: "Webhook Trigger",
    summary:
      "Use Webhook Trigger when another approved system should start the workflow by sending an event to FlowForge.",
    bestFor: [
      "Starting work as soon as an outside system sends a request or update.",
      "Connecting forms, portals, vendor systems, or internal tools to a workflow.",
      "Reacting to live events without waiting for a schedule.",
    ],
    inputs: [
      { label: "Approved webhook source", description: "The trusted source that is allowed to start this workflow." },
      { label: "Incoming event", description: "The event name and payload sent by the outside system." },
      { label: "Saved workflow version", description: "The workflow version that handles incoming webhook events." },
    ],
    outputs: [
      { label: "A workflow run", description: "The webhook creates a new run for the incoming event." },
      { label: "Event details", description: "Later steps can use the fields sent by the source system." },
      { label: "Webhook history", description: "The run timeline shows that the workflow started from a webhook." },
    ],
    examples: [
      { title: "New form submission", body: "A form system sends a submission, and the workflow routes it for matching and review." },
      { title: "Partner update", body: "A partner system sends a status change, and FlowForge starts the follow-up workflow immediately." },
    ],
    tips: [
      "Use an approved source so unexpected systems cannot start the workflow.",
      "Add Map / Transform when incoming field names need cleanup before later steps use them.",
      "Add Capture Event when the incoming reason, source, or timing should be reportable.",
    ],
  },
  file_watch_trigger: {
    type: "file_watch_trigger",
    title: "File Watch Trigger",
    summary:
      "Use File Watch Trigger when a workflow should begin after an allowed file arrives in an approved location.",
    bestFor: [
      "Starting import, validation, or review work when a file is delivered.",
      "Watching for expected file names, such as daily CSVs or weekly reports.",
      "Reducing manual checks for newly arrived files.",
    ],
    inputs: [
      { label: "Approved file source", description: "The location FlowForge is allowed to watch for incoming files." },
      { label: "Filename pattern", description: "The naming rule that tells FlowForge which files should start this workflow." },
      { label: "File details", description: "Information about the file, such as name, arrival time, and source." },
    ],
    outputs: [
      { label: "A workflow run", description: "A matching file creates a new run." },
      { label: "File context", description: "Later steps can use details about the file that started the workflow." },
      { label: "Arrival history", description: "The run timeline records that the workflow started from a watched file." },
    ],
    examples: [
      { title: "Inbound roster", body: "A roster file arrives, the workflow imports it, validates it, and sends exceptions for review." },
      { title: "Vendor delivery", body: "A vendor drops a weekly file, and the workflow extracts, maps, and stages it." },
    ],
    tips: [
      "Use Import after File Watch Trigger when the file contains data that needs validation.",
      "Keep filename patterns specific enough to avoid starting runs for unrelated files.",
      "Use Capture Event if arrival time or file name should appear in reports.",
    ],
  },
  intake: {
    type: "intake",
    title: "Intake Event",
    summary:
      "Use Intake Event to bring information from an integration, form, or manual event into the workflow in a consistent shape.",
    bestFor: [
      "Starting or standardizing work from a form submission, integration event, or manual intake.",
      "Collecting incoming fields before matching, routing, notification, or review steps.",
      "Giving later steps a predictable set of values to work with.",
    ],
    inputs: [
      { label: "Intake source", description: "The form, integration, or event source that provides the information." },
      { label: "Event name", description: "The kind of intake event the workflow should handle." },
      { label: "Incoming fields", description: "The details submitted with the event, such as names, notes, dates, or identifiers." },
    ],
    outputs: [
      { label: "Structured intake values", description: "Later steps can use the intake fields in messages, matching, decisions, and reporting." },
      { label: "Intake history", description: "The run records what source started or fed the workflow." },
      { label: "Context for the next step", description: "The workflow passes the intake information to the connected node." },
    ],
    examples: [
      { title: "Referral intake", body: "A referral form arrives and the workflow prepares the details for matching and human review." },
      { title: "Manual request", body: "A coordinator records a request, then the workflow routes it through the right approval path." },
    ],
    tips: [
      "Use Map / Transform after Intake Event when field names or formats need cleanup.",
      "Use Human Task when someone needs to review or complete the incoming information.",
      "Use Capture Event for important intake reasons or notes that should appear in reports.",
    ],
  },
  matching: {
    type: "matching",
    title: "Matching",
    summary:
      "Use Matching to compare workflow information against an approved resource pool and choose the best available option.",
    bestFor: [
      "Routing work to the best person, team, location, or resource.",
      "Using a published matching policy instead of one-off manual selection.",
      "Branching differently when a match is found or no match is available.",
    ],
    inputs: [
      { label: "Published matching policy", description: "The approved rules that define what a good match means." },
      { label: "Workflow context", description: "The values from earlier steps that help the policy make a match." },
      { label: "Resource pool", description: "The approved list of people, teams, records, or resources to choose from." },
    ],
    outputs: [
      { label: "Matched result", description: "The selected match can be used by later tasks, notifications, or exports." },
      { label: "Match or no-match path", description: "The workflow can take one route when a match exists and another when it does not." },
      { label: "Matching details", description: "The run records enough detail for operators to understand the matching outcome." },
    ],
    examples: [
      { title: "Route to an available reviewer", body: "Match a request to the reviewer who fits the policy and has capacity." },
      { title: "Find the best service location", body: "Use incoming details to choose a location, then notify the assigned team." },
    ],
    tips: [
      "Publish and test the matching policy before using it in a production workflow.",
      "Add a Human Task after a no-match path when a person should resolve exceptions.",
      "Capture match outcomes if matching performance will be reported later.",
    ],
  },
  human_task: {
    type: "human_task",
    title: "Human Task",
    summary:
      "Use Human Task when the workflow needs a person to review, answer, accept, decline, approve, or provide more information.",
    bestFor: [
      "Pausing a workflow until a person responds.",
      "Collecting a decision, note, reason, or answer from an operator or reviewer.",
      "Routing work to one person or a sequence of people.",
    ],
    inputs: [
      { label: "Assigned people or group", description: "Who should receive and complete the task." },
      { label: "Task message", description: "The communication template and context that explain what the person needs to do." },
      { label: "Timeout rules", description: "How long the workflow should wait before treating the task as overdue or timed out." },
    ],
    outputs: [
      { label: "Human response", description: "The selected response, note, or answer is passed to later steps." },
      { label: "Task timing", description: "The workflow records when the task was sent and when it was completed." },
      { label: "Response path", description: "Decision steps can branch based on the person's response." },
    ],
    examples: [
      { title: "Review a referral", body: "Send a reviewer the intake details and wait for accept, decline, or needs-more-information." },
      { title: "Collect a reason", body: "Ask an operator why a case was paused, then capture that reason for reporting." },
    ],
    tips: [
      "Use clear response options so downstream Decision steps are easy to configure.",
      "Use Capture Event after Human Task when the response reason should appear in reports.",
      "Set a timeout when work should not wait forever.",
    ],
  },
  notification: {
    type: "notification",
    title: "Notification",
    summary:
      "Use Notification to send an email or message from an approved template without waiting for a response.",
    bestFor: [
      "Keeping people informed as the workflow moves forward.",
      "Sending confirmations, reminders, handoffs, or status updates.",
      "Notifying a person or team without pausing the workflow for an answer.",
    ],
    inputs: [
      { label: "Recipients", description: "The people, groups, or addresses that should receive the message." },
      { label: "Communication template", description: "The approved message content and subject to send." },
      { label: "Workflow values", description: "Details from earlier steps that can personalize the message." },
    ],
    outputs: [
      { label: "Queued notification", description: "The message is prepared and queued for delivery." },
      { label: "Notification record", description: "The run records that a notification was requested." },
      { label: "Unchanged workflow context", description: "The workflow keeps moving with the same values it already had." },
    ],
    examples: [
      { title: "Send a confirmation", body: "After an intake is accepted, send the requester a confirmation message." },
      { title: "Notify the assigned team", body: "After matching chooses a team, send that team the details they need." },
    ],
    tips: [
      "Use Human Task instead when you need a response.",
      "Use templates so messages stay consistent and approved.",
      "Include only the information recipients are allowed to see.",
    ],
  },
  decision: {
    type: "decision",
    title: "Decision",
    summary:
      "Use Decision when the workflow should choose a path based on a response, status, match result, or other workflow information.",
    bestFor: [
      "Branching after a Human Task, Matching step, Approval Gate, or validation result.",
      "Sending approved, declined, timed out, and exception cases down different paths.",
      "Keeping workflow logic visible instead of hidden inside manual instructions.",
    ],
    inputs: [
      { label: "Workflow value to check", description: "The response, status, field, or result that controls the branch." },
      { label: "Outcome list", description: "The possible paths the workflow can take." },
      { label: "Connected branches", description: "The next steps attached to each outcome." },
    ],
    outputs: [
      { label: "Selected path", description: "The workflow continues on the branch that matches the current value." },
      { label: "Decision detail", description: "The run records which outcome was chosen." },
      { label: "Context for later steps", description: "Later steps can still use the values that led to the decision." },
    ],
    examples: [
      { title: "Review outcome", body: "If a reviewer approves, continue to export. If declined, notify the requester." },
      { title: "No match exception", body: "If Matching finds no available resource, send the case to a human queue." },
    ],
    tips: [
      "Name outcomes in words operators understand, such as approved, declined, or needs attention.",
      "Keep branches simple when possible.",
      "Use End Event on paths that should stop cleanly.",
    ],
  },
  end: {
    type: "end",
    title: "End Event",
    summary:
      "Use End Event to finish a workflow path and record the final outcome.",
    bestFor: [
      "Clearly marking where a workflow path stops.",
      "Recording completed, declined, canceled, or exception outcomes.",
      "Making reports and run history easier to understand.",
    ],
    inputs: [
      { label: "Final event key", description: "The short name for the ending that should be recorded." },
      { label: "Workflow status", description: "The final meaning of this path, such as completed or stopped." },
      { label: "Context from earlier steps", description: "The details that explain how the workflow reached this ending." },
    ],
    outputs: [
      { label: "Finished workflow path", description: "The current path stops at the End Event." },
      { label: "Final run history", description: "The workflow records the final outcome in the run timeline." },
      { label: "Reporting signal", description: "Reports can use the final event to count and compare outcomes." },
    ],
    examples: [
      { title: "Successful completion", body: "After the final notification is sent, record the workflow as completed." },
      { title: "Declined path", body: "After a reviewer declines a request, notify the requester and end that path." },
    ],
    tips: [
      "Use clear final event names so reports are easy to read.",
      "Add End Events to exception paths as well as happy paths.",
      "Use Capture Event before ending when final notes or reasons matter.",
    ],
  },
  event_capture: {
    type: "event_capture",
    title: "Capture Event",
    summary:
      "Use Capture Event to save important workflow details, reasons, notes, timings, or reporting facts as the workflow runs.",
    bestFor: [
      "Recording why something happened in plain language.",
      "Making human responses, timing, or exception details available for reports.",
      "Saving key moments without stopping the workflow.",
    ],
    inputs: [
      { label: "Fields to capture", description: "The reasons, notes, timings, responses, or values that should be recorded." },
      { label: "Workflow context", description: "The information from previous steps that provides the captured detail." },
      { label: "Capture label", description: "A clear name that explains what this captured event means." },
    ],
    outputs: [
      { label: "Reportable event", description: "The captured details become available for run history and reporting." },
      { label: "Captured fields", description: "The selected values are saved with the run." },
      { label: "Continued workflow context", description: "The workflow passes the captured information forward." },
    ],
    examples: [
      { title: "Human-readable reason", body: "After a person declines a task, capture the reason so reports show more than just declined." },
      { title: "Response timing", body: "Capture how long a Human Task took before the workflow moves to the next step." },
    ],
    tips: [
      "Capture details close to where they happen in the workflow.",
      "Use names that make sense in reports.",
      "Capture Event records information; it does not send messages or make decisions by itself.",
    ],
  },
  iterator: {
    type: "iterator",
    title: "Loop / Next Item",
    summary:
      "Use Loop / Next Item when the workflow needs to repeat a section for each candidate, record, or item until the work is done.",
    bestFor: [
      "Trying the next matched candidate when the first one declines or times out.",
      "Processing a list of records one at a time.",
      "Repeating part of the workflow until a stop condition is reached.",
    ],
    inputs: [
      { label: "Item list", description: "The candidates, records, or values the workflow should move through." },
      { label: "Current item", description: "Where the workflow is in the list right now." },
      { label: "Stop rule", description: "The condition that tells the loop when to stop." },
    ],
    outputs: [
      { label: "Next item", description: "The workflow continues with the next available item." },
      { label: "Done path", description: "When there are no more items or the stop rule is met, the workflow can leave the loop." },
      { label: "Loop progress", description: "The run records progress through the list." },
    ],
    examples: [
      { title: "Try another reviewer", body: "If the first reviewer declines, move to the next matched reviewer and send a new task." },
      { title: "Process a batch", body: "Work through imported records one by one and capture exceptions as they appear." },
    ],
    tips: [
      "Keep loops focused so workflow paths stay easy to follow.",
      "Use a clear stop rule to avoid repeated work that never finishes.",
      "Use Capture Event when each loop attempt should be reportable.",
    ],
  },
  query_extract: {
    type: "query_extract",
    title: "Query Extract",
    summary:
      "Use Query Extract to run a governed saved query or semantic plan and create a dataset that later steps can use.",
    bestFor: [
      "Gathering governed data before an export, import, review, or notification.",
      "Using an approved query instead of asking operators to pull data manually.",
      "Creating a reusable dataset artifact inside the workflow run.",
    ],
    inputs: [
      { label: "Saved query or semantic plan", description: "The governed query definition FlowForge is allowed to run." },
      { label: "Row limit", description: "An optional limit that keeps the extract to the expected size." },
      { label: "Artifact name", description: "The name later steps use to find the extracted data." },
    ],
    outputs: [
      { label: "Dataset artifact", description: "The extracted rows are stored for later workflow steps." },
      { label: "Extract summary", description: "The run can show details such as row count or extract status." },
      { label: "Governed query history", description: "The workflow records that the extract came from an approved query." },
    ],
    examples: [
      { title: "Prepare a weekly report", body: "Run a saved query, then export the results to an allowed destination." },
      { title: "Build a review list", body: "Extract records that need attention and send them through Human Task review." },
    ],
    tips: [
      "Use approved saved queries for repeatable results.",
      "Use Map / Transform after Query Extract when fields need formatting before export.",
      "Use Approval Gate before moving sensitive extracts outside the system.",
    ],
  },
  map_transform: {
    type: "map_transform",
    title: "Map / Transform",
    summary:
      "Use Map / Transform to rename, clean up, validate, or reshape values before the workflow uses them in messages, imports, exports, or decisions.",
    bestFor: [
      "Turning incoming fields into the names later steps expect.",
      "Checking that required values are present before side effects happen.",
      "Preparing data from an intake, import, or query extract for the next step.",
    ],
    inputs: [
      { label: "Source values", description: "The fields or dataset produced by earlier workflow steps." },
      { label: "Mapping rules", description: "Instructions for where each value should go and how it should be named." },
      { label: "Validation rules", description: "Checks that confirm values are present or formatted correctly." },
    ],
    outputs: [
      { label: "Normalized values", description: "Later steps receive cleaner, more predictable fields." },
      { label: "Validation result", description: "The workflow can see whether the mapped data passed the checks." },
      { label: "Transformed artifact", description: "When working with rows, the mapped result can be passed as a dataset artifact." },
    ],
    examples: [
      { title: "Clean form fields", body: "Rename incoming form fields so a notification template can use friendly values." },
      { title: "Prepare an export", body: "Map query results into the column names expected by the destination." },
    ],
    tips: [
      "Use clear field labels so templates and reports are easier to maintain.",
      "Validate before Export or Import when missing values would create bad downstream data.",
      "Keep mappings small and focused when possible.",
    ],
  },
  approval: {
    type: "approval",
    title: "Approval Gate",
    summary:
      "Use Approval Gate when a workflow should pause for operator approval before a sensitive or risky action happens.",
    bestFor: [
      "Reviewing exports, imports, or data movement before they run.",
      "Adding a human checkpoint before sensitive side effects.",
      "Creating an audit trail for who approved the action and why.",
    ],
    inputs: [
      { label: "Approver group", description: "The people allowed to approve or reject the gate." },
      { label: "Approval reason", description: "A plain-language explanation of what the approver is reviewing." },
      { label: "Workflow context", description: "The data, destination, or action that needs approval." },
    ],
    outputs: [
      { label: "Approval decision", description: "The workflow records whether the gate was approved or rejected." },
      { label: "Approver details", description: "The run captures who made the decision and when." },
      { label: "Approved or rejected path", description: "Later steps can branch based on the approval result." },
    ],
    examples: [
      { title: "Approve a sensitive export", body: "Pause before sending a dataset outside the system and let an operator approve it." },
      { title: "Review an import activation", body: "Stage inbound data, then require approval before activating it." },
    ],
    tips: [
      "Place Approval Gate immediately before the action it protects.",
      "Use a clear reason so approvers know what they are deciding.",
      "Use Capture Event if approval notes should appear in reports.",
    ],
  },
  export: {
    type: "export",
    title: "Export",
    summary:
      "Use Export to write a dataset artifact to an approved destination in the selected format.",
    bestFor: [
      "Sending governed query results, transformed rows, or workflow output to an allowed destination.",
      "Creating CSV or other approved files for downstream teams or systems.",
      "Moving data only after the workflow has prepared and checked it.",
    ],
    inputs: [
      { label: "Dataset artifact", description: "The data produced by Query Extract, Map / Transform, Import, or another earlier step." },
      { label: "Approved destination", description: "The location FlowForge is allowed to write to." },
      { label: "Export format", description: "The file or output format, such as CSV." },
    ],
    outputs: [
      { label: "Exported file or dataset", description: "The workflow writes the data to the chosen destination." },
      { label: "Export summary", description: "The run records export details such as destination, format, and status." },
      { label: "Data movement history", description: "Operators can see that the workflow performed an export." },
    ],
    examples: [
      { title: "Weekly CSV delivery", body: "Run a governed query, map the columns, approve the movement, and export a CSV." },
      { title: "Exception list", body: "Export rows that failed validation so a team can review them." },
    ],
    tips: [
      "Use Approval Gate before Export when the data is sensitive or leaves a controlled area.",
      "Use Map / Transform to prepare column names before exporting.",
      "Use only approved destinations.",
    ],
  },
  import: {
    type: "import",
    title: "Import",
    summary:
      "Use Import to stage inbound data for validation before it is activated, published, or used by later workflow steps.",
    bestFor: [
      "Bringing in a file delivered by File Watch Trigger or another approved source.",
      "Validating inbound rows before they affect active records.",
      "Creating a controlled review point for new or changed data.",
    ],
    inputs: [
      { label: "Approved source", description: "The file source or inbound location FlowForge is allowed to read from." },
      { label: "File name", description: "The file or object that should be imported." },
      { label: "Resource set and activation choice", description: "Where staged data belongs and whether it should be activated automatically." },
    ],
    outputs: [
      { label: "Staged data", description: "The incoming data is loaded into a controlled staging area." },
      { label: "Import summary", description: "The run records counts, status, and validation details." },
      { label: "Import artifact", description: "Later steps can use the import result for review, approval, or reporting." },
    ],
    examples: [
      { title: "Stage a roster file", body: "A watched file arrives, Import stages the rows, and a Human Task reviews exceptions." },
      { title: "Controlled activation", body: "Import the file, validate it, require approval, then activate the clean data." },
    ],
    tips: [
      "Use Import before activating inbound data.",
      "Use Approval Gate when activation needs human review.",
      "Use Capture Event to report validation issues or import reasons.",
    ],
  },
};

export function getWorkflowPaletteDoc(type: FlowForgeNodeType): WorkflowPaletteDoc | undefined {
  return WORKFLOW_PALETTE_DOCS[type];
}
