from pydantic import BaseModel, Field
from typing import Dict, Any, Optional


class Product(BaseModel):
    sku: str
    name: str
    category: str
    description: str
    specs: Dict[str, Any] = Field(default_factory=dict)
    uom: Optional[str] = None


class CatalogIssue(BaseModel):
    sku: str
    issue_type: str
    message: str
    severity: str