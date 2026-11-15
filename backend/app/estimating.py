"""Validated decimal calculations and immutable estimate documents."""
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from fastapi import HTTPException

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class Line(StrictModel):
    description: str = Field(min_length=1, max_length=500)
    kind: Literal["labor", "material", "subcontractor"]
    quantity: Decimal = Field(gt=0, le=1000000, decimal_places=3, allow_inf_nan=False)
    unit: str = Field(min_length=1, max_length=30)
    unit_cost: Decimal = Field(ge=0, le=10000000, decimal_places=2, allow_inf_nan=False)

class Section(StrictModel):
    name: str = Field(min_length=1, max_length=150)
    lines: list[Line] = Field(min_length=1, max_length=100)

class EstimateIn(StrictModel):
    version: int = Field(ge=1)
    markup_percent: Decimal = Field(ge=0, le=1000, decimal_places=2, allow_inf_nan=False)
    tax_percent: Decimal = Field(ge=0, le=100, decimal_places=2, allow_inf_nan=False)
    tax_basis: Literal["none", "materials", "all"]
    sections: list[Section] = Field(min_length=1, max_length=30)
    notes: str = Field(default="", max_length=5000)
    scope: str | None = Field(default=None, min_length=1, max_length=10000)

def rounded(value):
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

def calculate(payload: EstimateIn):
    document = payload.model_dump(mode="json", exclude={"version", "scope"})
    cost = markup = taxable = 0
    for section, source in zip(document["sections"], payload.sections):
        for line, original in zip(section["lines"], source.lines):
            line["cost_cents"] = rounded(original.quantity * original.unit_cost * 100)
            line["markup_cents"] = rounded(Decimal(line["cost_cents"]) * payload.markup_percent / 100)
            line["price_cents"] = line["cost_cents"] + line["markup_cents"]
            cost += line["cost_cents"]
            markup += line["markup_cents"]
            if payload.tax_basis == "all" or (payload.tax_basis == "materials" and original.kind == "material"):
                taxable += line["price_cents"]
        section["price_cents"] = sum(line["price_cents"] for line in section["lines"])
    tax = rounded(Decimal(taxable) * payload.tax_percent / 100)
    if cost + markup + tax > 1000000000000:
        raise HTTPException(422, "Estimate exceeds the supported $10 billion limit")
    document["totals"] = dict(cost_cents=cost, markup_cents=markup, subtotal_cents=cost+markup,
                              taxable_cents=taxable, tax_cents=tax, total_cents=cost+markup+tax)
    return document

def client_document(document):
    return {
        "job": document["job"], "notes": document["notes"],
        "sections": [{"name": s["name"], "price_cents": s["price_cents"],
                      "lines": [{k: line[k] for k in ("description", "quantity", "unit", "price_cents")}
                                for line in s["lines"]]} for s in document["sections"]],
        "totals": {k: document["totals"][k] for k in ("subtotal_cents", "tax_cents", "total_cents")}
    }
