# AI-First Architecture for Risk Questionnaire Evaluation

**Location:** `/docs/ai-first-risk-eval-architecture.md`
**Author:** Eric Beser

---

## 1. Understanding the Problem

The legacy .NET 3.5 MVC application processes a 100-question risk analysis questionnaire. When a user submits responses, the system:

1. Saves answers to SQL Server
2. Runs risk evaluation logic in C#
3. Writes scores and results back to SQL

Right now, everything happens **synchronously in the MVC request**. This creates several problems:

* Slow response times while the user waits for evaluation to complete
* Evaluation logic spread across C# conditionals and loops
* Multiple SQL trips that slow everything down
* Any rule change requires modifying code and redeploying
* System becomes brittle as the questionnaire evolves

We want a better approach that:

* Keeps the user experience fast
* Centralizes and simplifies the evaluation logic
* Allows AI to deliver richer, more adaptive risk analysis
* Doesn’t require rewriting the legacy application

---

## 2. Proposed AI-First Architectural Direction

This design moves evaluation out of MVC and into **n8n + AI**, using the Webhook → Respond to Webhook pattern.

### High-Level Shift

* **MVC app**
  Handles data entry and receives the evaluation result.

* **n8n workflow**
  Does all processing:

  * Saves data
  * Retrieves metadata
  * Calls an AI model for scoring
  * Writes structured results to SQL
  * Responds to MVC via **Respond to Webhook**

### Why this helps

* The evaluation is no longer inside the MVC request pipeline
* AI replaces rigid C# rule logic
* Updating logic requires adjusting prompts or metadata, not code
* n8n workflows stay visible, debuggable, and adjustable
* MVC receives a clean JSON response and renders the report immediately

---

## 3. Revised Data Flow (Webhook + Respond to Webhook)

1. User fills out 100 questions and submits.
2. MVC collects answers and posts a JSON payload to the n8n Webhook endpoint.
3. n8n Webhook node receives the request and defers the response to a later node.
4. n8n workflow:

   * Parses the incoming answers
   * Writes answer rows to SQL
   * Retrieves question metadata
   * Calls AI to generate domain scores, weaknesses, and recommendations
   * Writes results to `RiskSummary`, `RiskDomain`, and `RiskRecommendation`
5. n8n Respond to Webhook node sends JSON back to MVC.
6. MVC receives the risk evaluation results and renders a report page.

The user sees a single, responsive workflow with no long pauses.

---

## 4. Implementation Plan

### Phase 1 — Database + MVC Endpoint

#### Database Tables

* **RiskEvaluationJob**
  Tracks each evaluation.

* **QuestionnaireAnswers**
  Stores the raw 100 answers.

* **RiskSummary**
  Stores overall score and band.

* **RiskDomain**
  Per-domain scoring and key weaknesses.

* **RiskRecommendation**
  Detailed mitigation suggestions.

#### MVC endpoint (`POST /Risk/Analyze`)

* Validates 100-question payload
* Builds request JSON
* Posts to n8n Webhook URL
* Waits for AI-evaluated response
* Deserializes JSON
* Renders results page

No evaluation logic happens inside MVC.

---

### Phase 2 — n8n Workflow

#### 1. Webhook Node

* Method: POST
* Path: `/risk-analysis`
* “Respond Using Respond to Webhook” enabled

#### 2. Parse input

Normalize:

```json
{
  "jobId": "guid",
  "locationId": 123,
  "questionnaireId": 456,
  "answers": [
    { "questionId": 1, "value": "Yes" },
    { "questionId": 2, "value": "No" }
  ]
}
```

#### 3. SQL Nodes (Insert answers, create job)

Batch insert for performance.

#### 4. SQL Node (Fetch question metadata)

Retrieve domain mappings, weights, thresholds, labels, etc.

#### 5. AI Node (Evaluation Engine)

Prompt:

> You are a property risk analyst.
> Evaluate each risk domain based on questionnaire answers.
> For each domain:
>
> * Assign a 0–100 risk score
> * Identify the top weaknesses (with question IDs)
> * Provide 30-day actionable mitigation steps
>   Also provide an overall risk score and risk band.

Output is a structured JSON risk report.

#### 6. SQL Nodes (Persist Results)

Insert into:

* `RiskSummary`
* `RiskDomain`
* `RiskRecommendation`

#### 7. Respond to Webhook Node

Responds to MVC with JSON such as:

```json
{
  "jobId": "guid",
  "overallScore": 78,
  "overallBand": "High",
  "domains": [
    {
      "name": "Fire",
      "score": 85,
      "weaknesses": [...],
      "recommendations": [...]
    }
  ]
}
```

MVC receives the full risk report immediately.

---

## 5. MVC UI Integration

### View Model

A simple C# class mapping to the returned JSON:

```csharp
public class RiskReportViewModel
{
    public string JobId { get; set; }
    public int OverallScore { get; set; }
    public string OverallBand { get; set; }
    public List<RiskDomainViewModel> Domains { get; set; }
}
```

### View

Shows:

* Overall band (color-coded)
* Domain scores
* Weakness lists
* Recommended actions

No blocking. No background polling. Just direct results.

---

## 6. Success Rubric

### 1. Performance

* MVC → n8n → MVC round-trip completes under 60 seconds
* No timeouts
* Workflow reliably hits Respond to Webhook

### 2. Quality

* AI produces consistent scores for identical inputs
* Weaknesses and recommendations are accurate and useful
* Output aligns with internal risk standards

### 3. Maintainability

* New questions only require metadata/prompt updates
* No changes to MVC code for rule tweaks
* n8n flow remains readable and testable

### 4. User Experience

* Single fast submit → evaluation → results flow
* Output is clear, helpful, and actionable
* No more slow multi-minute MVC evaluations

---

## 7. Summary

This architecture modernizes a legacy .NET 3.5 MVC system without rewriting it.
n8n and an AI model handle everything the old C# logic was doing — only faster, smarter, and far easier to maintain.
The Webhook → Respond to Webhook flow creates a clean, synchronous, modern evaluation cycle that delivers instant value to users.

## 8. Sequence Diagram

sequenceDiagram
    participant U as User (Browser)
    participant MVC as MVC App (.NET 3.5)
    participant N8N as n8n Webhook
    participant WF as n8n Workflow
    participant AI as AI Evaluation Node
    participant DB as SQL Server

    U->>MVC: Submit 100-question form
    MVC->>MVC: Validate input and build JSON payload
    MVC->>N8N: HTTP POST /webhook/risk-analysis
    N8N->>WF: Trigger workflow execution

    WF->>DB: Insert QuestionnaireAnswers and RiskEvaluationJob
    WF->>DB: Fetch question metadata (domains, weights, labels)

    WF->>AI: Send structured answers and metadata
    AI-->>WF: Return scores, weaknesses, recommendations, overall band

    WF->>DB: Persist RiskSummary
    WF->>DB: Persist RiskDomain entries
    WF->>DB: Persist RiskRecommendation entries

    WF->>N8N: Prepare JSON response for MVC
    N8N-->>MVC: Respond to Webhook with risk report JSON




