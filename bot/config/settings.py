from ._runtime import export_section


export_section("settings", globals())
show_bot_cursor = globals().get("show_bot_cursor", True)
use_context_ai = globals().get("use_context_ai", False)
__all__ = sorted(set(__all__ + ["show_bot_cursor", "use_context_ai"]))
