"""Cross-reference placement (ETSU unassigned files) — retrieval + response handling, no network."""
import json
from types import SimpleNamespace

from app.evidence.xref_placement import PassageIndex, place_files

NARR = [
    {"std": "3", "spec": "b", "text": "The Advisory Committee meets each fall and spring. Minutes of advisory committee meetings from the last two years are attached, with the committee roster."},
    {"std": "21", "spec": "g", "text": "Students log every field hour in Time2Track; supervisors approve the hours each week and the program exports an hours summary for every student."},
    {"std": "1", "spec": "b", "text": " ".join(["The program prepares human services professionals for direct service roles."] * 30)},
]
SPECS = [{"std": "3", "spec": "b", "prompt": "An Advisory Committee shall be established"},
         {"std": "21", "spec": "g", "prompt": "Provide evidence that required field experience is no less than 350 hours"},
         {"std": "1", "spec": "b", "prompt": "Primary objective"}]


def test_retrieval_finds_the_passage_that_describes_the_file():
    idx = PassageIndex(NARR)
    top = idx.query("Hours Summary by Student.xlsx", "ETSU/CSHSE Reaccreditation/Time2Track Data/Hours Summary by Student.xlsx", "Student Cohort Hours Logged Time2Track")
    assert top and (top[0]["std"], top[0]["spec"]) == ("21", "g")
    top = idx.query("Fall 2025 Minutes.docx", "ETSU/HS Advisory Committee/Fall 2025/Fall 2025 Minutes.docx", "Community Advisory Committee Meeting Minutes")
    assert (top[0]["std"], top[0]["spec"]) == ("3", "b")


class FakeClient:
    def __init__(self, replies):
        self.replies = replies
        self.messages = self
        self.calls = []

    def create(self, **kw):
        self.calls.append(kw)
        name = kw["messages"][0]["content"].split("\n")[0].replace("FILE NAME: ", "")
        r = self.replies[name]
        if isinstance(r, Exception):
            raise r
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=r)])


def test_results_are_validated_and_one_failure_does_not_sink_the_batch():
    replies = {
        "a.docx": json.dumps({"kind": "evidence", "standard": "3", "spec": "b", "confidence": 0.9, "reason": "minutes", "passage_spec": "3.b"}),
        "b.docx": 'Here you go: {"kind": "evidence", "standard": "3", "spec": "z", "confidence": 1.7, "reason": "bad spec"}',
        "c.docx": json.dumps({"kind": "working_file", "standard": "1", "spec": "b", "confidence": 0.8, "reason": "old self-study"}),
        "d.docx": RuntimeError("boom"),
    }
    client = FakeClient(replies)
    files = [{"id": k, "name": k, "path": "", "text": "x"} for k in replies]
    out = {r["id"]: r for r in place_files(client, SPECS, NARR, files, workers=2)}
    assert (out["a.docx"]["std"], out["a.docx"]["spec"], out["a.docx"]["confidence"]) == ("3", "b", 0.9)
    assert out["b.docx"]["spec"] is None and out["b.docx"]["confidence"] == 1.0  # invalid spec dropped, conf clamped
    assert out["c.docx"]["kind"] == "working_file" and out["c.docx"]["std"] is None
    assert "boom" in out["d.docx"]["error"]
    # the spec catalog is sent as a cached system block
    sys_blocks = client.calls[0]["system"]
    assert sys_blocks[-1].get("cache_control") == {"type": "ephemeral"} and "3.b" in sys_blocks[-1]["text"]
