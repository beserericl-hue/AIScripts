"""A curriculum matrix uploaded on its own (ETSU 'Matrix- Completed 2026.docx')
has the official form's title but none of the self-study template's
#MatrixHSR / #Matrix2 anchors — it must still be extracted."""
from app.matrix.template_loader import align_template_to_handbook, load_matrix_template
from app.matrix.wire_format import _column_headers, anchor_standalone_matrix, build_wire_matrices
from app.standards.loader import load_specifications
from bs4 import BeautifulSoup

ROWS = [
    ("The historical roots of human services.", ["", "", "", "", "IKM", "", "", "", ""]),
    ("Historical and current legislation affecting services delivery.", ["IKL", "", "", "", "", "", "", "", ""]),
    ("The range and characteristics of human services delivery systems and organizations.", ["", "IKM", "", "", "", "KTM", "", "", ""]),
    ("Theories of human development.", ["", "", "IKH", "", "", "", "", "", "TSH"]),
]
COURSES = ["SRVL 1020", "HDAL 1110", "HDAL 2320", "HDAL 2510", "HDAL 3110", "HDAL 3510", "HDAL 3610", "HDAL 4710", "HDAL 4720"]


def _doc(title=True, anchor=False):
    legend = "<table><tr><td>Type of Course Content</td><td>Depth</td></tr><tr><td>I=Introduction</td><td>L=Low</td></tr></table>"
    head = "<tr><td>Standards and Specifications</td>" + "<td></td>" * 9 + "</tr>"
    head += "<tr><td>Knowledge, Theory, Skills, and Values</td>" + "<td></td>" * 9 + "</tr>"
    head += "<tr><td>History Context</td>" + "".join(f"<td>{c}</td>" for c in COURSES) + "</tr>"
    body = "".join("<tr><td>" + p + "</td>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>" for p, cells in ROWS)
    t = ("<p>Matrix Illustrating Relationship of Required Courses to Curriculum Standards</p>" if title else "<p>Course list</p>")
    t += "<p>Baccalaureate Degree Level Revised July 2025</p>" + legend
    t += ('<a id="MatrixHSR"></a>' if anchor else "") + "<table>" + head + body + "</table>"
    return t.encode()


def _aligned():
    return align_template_to_handbook(load_matrix_template("bachelors"), load_specifications("bachelors"))


def test_standalone_matrix_document_is_extracted_with_course_headers():
    mats, _ = build_wire_matrices(_doc(), _aligned())
    assert len(mats) == 1
    m = mats[0]
    assert m["columnHeaders"][:3] == ["SRVL 1020", "HDAL 1110", "HDAL 2320"]
    by = {(c["std"], c["spec"]): c for c in m["cells"]}
    assert by[("11", "b")]["codeRaw"] == "IKM" and by[("11", "b")]["columnHeader"] == "HDAL 3110"


def test_anchor_goes_before_the_matrix_table_not_the_legend():
    out = BeautifulSoup(anchor_standalone_matrix(_doc()), "html.parser")
    a = out.find("a", attrs={"id": "MatrixHSR"})
    assert a is not None and len(a.find_next("table").find_all("tr")) > 3


def test_negative_a_document_that_already_has_anchors_is_unchanged():
    src = _doc(anchor=True)
    assert anchor_standalone_matrix(src) == src


def test_negative_a_document_without_the_matrix_title_is_unchanged():
    src = _doc(title=False)
    assert anchor_standalone_matrix(src) == src
    mats, _ = build_wire_matrices(src, _aligned())
    assert mats == []


def test_column_headers_fall_back_to_first_row_without_course_numbers():
    t = BeautifulSoup("<table><tr><td>x</td><td>A</td><td>B</td></tr><tr><td>y</td><td>1</td><td>2</td></tr></table>", "html.parser").table
    assert _column_headers(t) == ["A", "B"]
