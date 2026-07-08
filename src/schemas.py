from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List


class Product(BaseModel):
    sku: str
    name: str
    category: str
    description: str
    brand: Optional[str] = None
    specs: Dict[str, Any] = Field(default_factory=dict)
    uom: Optional[str] = None
    price: Optional[float] = None
    search_terms: List[str] = Field(default_factory=list)


class CatalogIssue(BaseModel):
    sku: str
    issue_type: str
    message: str
    severity: str