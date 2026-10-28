from supabase import create_client, Client
from app.core.config import settings

_supabase_client: Client | None = None


def get_supabase() -> Client:
    """Return a Supabase client using service-role key (or effective anon key)."""
    global _supabase_client
    if _supabase_client is None:
        key = settings.supabase_service_role_key or settings.effective_anon_key
        _supabase_client = create_client(
            settings.supabase_url,
            key,
        )
    return _supabase_client
