# API Reference

> SOP-Guard REST API documentation. Base URL: `http://localhost:8000`

---

## Health Check

### `GET /api/health`

Returns server status.

**Response** `200 OK`
```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

---

## Query

### `POST /api/query`

Submit a question to the RAG pipeline.

**Request Body**
```json
{
  "query_text": "What is the hand hygiene protocol before patient contact?",
  "department": "Infection Control",
  "user_role": "nurse"
}
```

| Field        | Type   | Required | Description                          |
|-------------|--------|----------|--------------------------------------|
| query_text  | string | Yes      | The question to answer               |
| department  | string | No       | Filter retrieval to a department     |
| user_role   | string | No       | Role of the person asking            |

**Response** `200 OK`
```json
{
  "query_id": 42,
  "answer_text": "According to SOP INF-001 Section 3.2: Perform hand hygiene using alcohol-based hand rub (ABHR) for at least 20 seconds before any direct patient contact. If hands are visibly soiled, wash with soap and water for at least 40 seconds instead.",
  "confidence_score": 0.92,
  "verification_status": "verified",
  "sources": [
    {
      "sop_id": "INF-001",
      "title": "Hand Hygiene Policy",
      "section": "3.2 - Before Patient Contact",
      "relevance_score": 0.95
    }
  ],
  "verification_details": {
    "claims_checked": 3,
    "claims_supported": 3,
    "flagged_claims": []
  }
}
```

### `GET /api/query/history`

Retrieve past queries and answers.

**Query Parameters**

| Parameter  | Type    | Default | Description                   |
|-----------|---------|---------|-------------------------------|
| limit     | integer | 20      | Number of results to return   |
| offset    | integer | 0       | Pagination offset             |
| department| string  |         | Filter by department          |

**Response** `200 OK`
```json
{
  "queries": [
    {
      "id": 42,
      "query_text": "What is the hand hygiene protocol?",
      "answer_text": "According to SOP INF-001...",
      "confidence_score": 0.92,
      "verification_status": "verified",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

## SOP Management

### `POST /api/sops/upload`

Upload a new SOP document.

**Request** `multipart/form-data`

| Field      | Type   | Required | Description                        |
|-----------|--------|----------|------------------------------------|
| file      | file   | Yes      | PDF or DOCX file                   |
| title     | string | No       | Override extracted title           |
| department| string | No       | Department assignment              |

**Response** `201 Created`
```json
{
  "sop_id": "INF-005",
  "title": "Isolation Precautions",
  "department": "Infection Control",
  "version": "1.0",
  "chunks_created": 24,
  "status": "active"
}
```

### `GET /api/sops`

List all SOPs.

**Query Parameters**

| Parameter  | Type   | Default | Description              |
|-----------|--------|---------|--------------------------|
| department| string |         | Filter by department     |
| status    | string | active  | Filter by status         |
| limit     | integer| 50      | Results per page         |
| offset    | integer| 0       | Pagination offset        |

**Response** `200 OK`
```json
{
  "sops": [
    {
      "id": 1,
      "sop_id": "INF-001",
      "title": "Hand Hygiene Policy",
      "department": "Infection Control",
      "version": "2.1",
      "status": "active",
      "effective_date": "2024-01-01",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 45
}
```

### `GET /api/sops/{sop_id}`

Get a specific SOP by ID.

**Response** `200 OK`
```json
{
  "id": 1,
  "sop_id": "INF-001",
  "title": "Hand Hygiene Policy",
  "department": "Infection Control",
  "version": "2.1",
  "status": "active",
  "effective_date": "2024-01-01",
  "raw_text": "1. PURPOSE\nThis SOP establishes...",
  "structured_json": {
    "sections": [
      {
        "title": "Purpose",
        "content": "This SOP establishes..."
      }
    ]
  },
  "chunks": [
    {
      "id": 1,
      "section_title": "Purpose",
      "chunk_text": "This SOP establishes the hand hygiene...",
      "chunk_index": 0
    }
  ]
}
```

### `PUT /api/sops/{sop_id}`

Update SOP metadata.

**Request Body**
```json
{
  "title": "Hand Hygiene Policy (Revised)",
  "department": "Infection Control",
  "status": "active",
  "version": "2.2"
}
```

**Response** `200 OK`
```json
{
  "sop_id": "INF-001",
  "title": "Hand Hygiene Policy (Revised)",
  "version": "2.2",
  "updated_at": "2025-01-15T12:00:00Z"
}
```

### `DELETE /api/sops/{sop_id}`

Delete an SOP and all its chunks.

**Response** `200 OK`
```json
{
  "message": "SOP INF-001 deleted successfully"
}
```

---

## Feedback

### `POST /api/feedback`

Submit feedback on a query answer.

**Request Body**
```json
{
  "query_id": 42,
  "rating": 4,
  "comment": "Accurate but could include more detail about drying hands",
  "is_correct": true
}
```

| Field      | Type    | Required | Description                    |
|-----------|---------|----------|--------------------------------|
| query_id  | integer | Yes      | ID of the query being rated    |
| rating    | integer | Yes      | Quality rating 1-5             |
| comment   | string  | No       | Free-text feedback             |
| is_correct| boolean | No       | Whether the answer was correct |

**Response** `201 Created`
```json
{
  "feedback_id": 78,
  "query_id": 42,
  "rating": 4,
  "created_at": "2025-01-15T10:35:00Z"
}
```

### `GET /api/feedback/stats`

Get aggregated feedback statistics.

**Response** `200 OK`
```json
{
  "total_feedback": 234,
  "average_rating": 3.8,
  "correctness_rate": 0.87,
  "rating_distribution": {
    "1": 12,
    "2": 18,
    "3": 45,
    "4": 98,
    "5": 61
  }
}
```

---

## Voice

### `POST /api/voice/transcribe`

Transcribe audio input to text.

**Request** `multipart/form-data`

| Field | Type | Required | Description          |
|-------|------|----------|----------------------|
| audio | file | Yes      | Audio file (WAV, MP3)|

**Response** `200 OK`
```json
{
  "text": "What is the protocol for blood transfusion reactions?",
  "confidence": 0.95
}
```

> In mock mode (`WHISPER_MODE=mock`), returns a predefined transcription.

---

## Evaluation

### `GET /api/eval/run`

Run the evaluation suite against the current SOP corpus.

**Response** `200 OK`
```json
{
  "retrieval_metrics": {
    "precision_at_5": 0.78,
    "recall_at_5": 0.82,
    "mrr": 0.85,
    "ndcg": 0.80
  },
  "generation_metrics": {
    "faithfulness": 0.91,
    "relevance": 0.87,
    "hallucination_rate": 0.06
  },
  "user_metrics": {
    "average_rating": 3.8,
    "total_queries": 150,
    "total_feedback": 89
  }
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "detail": "SOP not found",
  "status_code": 404
}
```

| Status Code | Meaning                              |
|-------------|--------------------------------------|
| 400         | Bad request (invalid input)          |
| 404         | Resource not found                   |
| 422         | Validation error (Pydantic)          |
| 500         | Internal server error                |
