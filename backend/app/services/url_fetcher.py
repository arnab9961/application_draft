"""
URL fetcher service with SSRF protection.
Only fetches public URLs; blocks private IP ranges, localhost, and redirects to them.
"""
import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("fc00::/7"),         # IPv6 private
]


def _is_safe_host(host: str) -> bool:
    if host.lower() in BLOCKED_HOSTS:
        return False
    try:
        addr = ipaddress.ip_address(host)
        if addr.is_loopback or addr.is_private or addr.is_link_local:
            return False
        return True
    except ValueError:
        # hostname — resolve it
        try:
            resolved = socket.getaddrinfo(host, None)
            for _, _, _, _, addr_tuple in resolved:
                ip = ipaddress.ip_address(addr_tuple[0])
                if ip.is_loopback or ip.is_private or ip.is_link_local:
                    return False
        except Exception:
            return False
        return True


async def fetch_url_text(url: str, timeout: int = 15) -> str:
    """
    Fetch plain text content from a public URL.
    Raises ValueError if the URL is unsafe.
    Raises RuntimeError if the fetch fails.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs are supported.")
    host = parsed.hostname or ""
    if not _is_safe_host(host):
        raise ValueError("URL points to a private or restricted address.")

    async with httpx.AsyncClient(
        follow_redirects=True,
        max_redirects=5,
        timeout=timeout,
    ) as client:
        try:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Failed to fetch URL (HTTP {exc.response.status_code})"
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"Failed to fetch URL: {exc}") from exc

        # Validate redirect destinations
        if resp.url:
            final_host = urlparse(str(resp.url)).hostname or ""
            if not _is_safe_host(final_host):
                raise ValueError("Redirect to a private address blocked.")

        content_type = resp.headers.get("content-type", "")
        if "text" not in content_type and "html" not in content_type:
            raise RuntimeError("URL does not return text content.")

        return resp.text
