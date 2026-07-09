"""
Thin async client wrapper that launches catalog_server.py as a subprocess
and exposes its 4 tools as Python async methods.
"""

import json
import sys
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SERVER_SCRIPT = PROJECT_ROOT / "src" / "mcp_server" / "catalog_server.py"


class CatalogMCPClient:
    def __init__(self):
        self._session: ClientSession | None = None
        self._cm = None

    async def __aenter__(self) -> "CatalogMCPClient":
        params = StdioServerParameters(
            command=sys.executable,
            args=[str(SERVER_SCRIPT)],
            env=None,
        )
        self._cm = stdio_client(params)
        read, write = await self._cm.__aenter__()
        self._session = ClientSession(read, write)
        await self._session.__aenter__()
        await self._session.initialize()
        return self

    async def __aexit__(self, *exc_info) -> None:
        if self._session:
            await self._session.__aexit__(*exc_info)
        if self._cm:
            await self._cm.__aexit__(*exc_info)

    async def _call(self, tool: str, arguments: dict) -> Any:
        try:
            result = await self._session.call_tool(tool, arguments)
            raw = result.content[0].text if result.content else "null"
            return json.loads(raw)
        except Exception:
            return None

    async def search_products(self, query: str, top_k: int = 5) -> list[dict] | None:
        return await self._call("search_products", {"query": query, "top_k": top_k})

    async def get_product(self, sku: str) -> dict | None:
        result = await self._call("get_product", {"sku": sku})
        if result and "error" in result:
            return None
        return result

    async def get_compatibility(self, sku: str) -> list[dict] | None:
        return await self._call("get_compatibility", {"sku": sku})

    async def get_catalog_health(self) -> dict | None:
        return await self._call("get_catalog_health", {})
