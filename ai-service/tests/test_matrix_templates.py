"""Verify all three matrix templates load + parse correctly."""
from __future__ import annotations

from collections import Counter

import pytest

from app.matrix.template_loader import (
    align_template_to_handbook,
    load_matrix_template,
)
from app.standards.loader import load_specifications


def test_associate_template_loads():
    t = load_matrix_template("associate")
    assert t.program_level == "associate"
    assert "I" in t.legend and "H" in t.legend
    assert len(t.rows) >= 60  # ~66 expected
    # Associate has Standards 11-20 (no Std 21)
    stds = {r.standard_code for r in t.rows}
    assert "11" in stds
    assert "20" in stds


def test_bachelors_template_loads():
    t = load_matrix_template("bachelors")
    assert t.program_level == "bachelors"
    assert len(t.rows) >= 70  # ~78 expected
    stds = {r.standard_code for r in t.rows}
    # Bachelor's has Standards 11-21
    assert "11" in stds
    assert "21" in stds


def test_masters_template_loads():
    t = load_matrix_template("masters")
    assert t.program_level == "masters"
    assert len(t.rows) >= 40  # ~54 expected
    stds = {r.standard_code for r in t.rows}
    # Masters covers Standards 11-18 in this template format
    assert "11" in stds


def test_template_column_count_supports_courses():
    """All templates should have many columns (1 spec + multiple course columns)."""
    for level in ("associate", "bachelors", "masters"):
        t = load_matrix_template(level)
        assert t.column_count >= 10, f"{level} only has {t.column_count} columns"


def test_legend_codes_consistent_across_levels():
    """All three templates should share the same legend keys."""
    levels = ["associate", "bachelors", "masters"]
    keys_per_level = [set(load_matrix_template(l).legend.keys()) for l in levels]
    common = set.intersection(*keys_per_level)
    assert {"I", "T", "K", "S", "L", "M", "H"} <= common


def test_align_to_handbook_assigns_letters():
    """Aligning a template against the Handbook fills in spec_code letters."""
    t = load_matrix_template("bachelors")
    specs = load_specifications("bachelors")
    aligned = align_template_to_handbook(t, specs)
    with_letters = [r for r in aligned.rows if r.spec_code]
    assert with_letters, "no rows got spec codes assigned"
    # The first row of every Standard should get spec_code='a' if the
    # Handbook has at least one spec for that Standard.
    per_std_first_letters = {}
    for r in aligned.rows:
        if r.standard_code not in per_std_first_letters and r.spec_code:
            per_std_first_letters[r.standard_code] = r.spec_code
    # Every covered Standard should map to spec 'a' first
    for std, first in per_std_first_letters.items():
        assert first == "a", f"Std {std} first letter is {first}, not 'a'"
