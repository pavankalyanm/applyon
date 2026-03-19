from ._runtime import export_section


export_section("settings", globals())
show_bot_cursor = globals().get("show_bot_cursor", True)
__all__ = sorted(set(__all__ + ["show_bot_cursor"]))
